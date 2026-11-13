package com.doctree.app;

import android.content.Context;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** 本地 HTTP 服务：静态资源 + /proxy/llm 流式转发 */
public class LocalServer {
    private final Context ctx;
    private ServerSocket socket;
    private int port;

    public LocalServer(Context ctx) {
        this.ctx = ctx.getApplicationContext();
    }

    public int start() throws IOException {
        // 固定端口：WebView 的 localStorage / IndexedDB 按 origin（含端口）隔离，
        // 每次换端口会导致用户数据“消失”，所以优先用固定端口。
        int[] preferred = {47201, 47202, 47203};
        for (int p : preferred) {
            try {
                socket = new ServerSocket(p, 50, InetAddress.getByName("127.0.0.1"));
                port = p;
                break;
            } catch (IOException ignored) {
            }
        }
        if (socket == null) {
            socket = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
            port = socket.getLocalPort();
        }
        Thread t = new Thread(new LoopTask(), "doctree-server");
        t.setDaemon(true);
        t.start();
        return port;
    }

    public int getPort() {
        return port;
    }

    public void stop() {
        try {
            if (socket != null) socket.close();
        } catch (IOException ignored) {
        }
    }

    private class LoopTask implements Runnable {
        public void run() {
            while (true) {
                try {
                    Socket s = socket.accept();
                    Thread t = new Thread(new ConnTask(s), "doctree-conn");
                    t.setDaemon(true);
                    t.start();
                } catch (IOException e) {
                    return;
                }
            }
        }
    }

    private class ConnTask implements Runnable {
        private final Socket s;

        ConnTask(Socket s) {
            this.s = s;
        }

        public void run() {
            handle(s);
        }
    }

    private void handle(Socket s) {
        try {
            InputStream in = s.getInputStream();
            OutputStream out = s.getOutputStream();
            String head = readHead(in);
            if (head == null || head.isEmpty()) return;
            String[] lines = head.split("\r\n");
            String[] first = lines[0].split(" ");
            if (first.length < 2) return;
            String method = first[0];
            String path = first[1].split("\\?")[0];
            Map<String, String> headers = new HashMap<>();
            for (int i = 1; i < lines.length; i++) {
                int idx = lines[i].indexOf(':');
                if (idx > 0) {
                    headers.put(lines[i].substring(0, idx).trim().toLowerCase(Locale.ROOT),
                            lines[i].substring(idx + 1).trim());
                }
            }
            int len = 0;
            try {
                len = Integer.parseInt(headers.getOrDefault("content-length", "0"));
            } catch (NumberFormatException ignored) {
            }
            byte[] body = new byte[len];
            int read = 0;
            while (read < len) {
                int n = in.read(body, read, len - read);
                if (n < 0) break;
                read += n;
            }

            if ("/proxy/llm".equals(path) && "POST".equals(method)) {
                proxy(headers, body, out);
            } else if ("GET".equals(method)) {
                serve(path, out);
            } else {
                writeText(out, 404, "not found");
            }
            out.flush();
            s.close();
        } catch (Exception e) {
            try {
                s.close();
            } catch (IOException ignored) {
            }
        }
    }

    private String readHead(InputStream in) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        int prev1 = -1, prev2 = -1, prev3 = -1;
        while (true) {
            int b = in.read();
            if (b < 0) break;
            buf.write(b);
            if (prev1 == '\r' && prev2 == '\n' && prev3 == '\r' && b == '\n') break;
            prev1 = prev2;
            prev2 = prev3;
            prev3 = b;
            if (buf.size() > 65536) break;
        }
        return new String(buf.toByteArray(), StandardCharsets.UTF_8);
    }

    private void proxy(Map<String, String> headers, byte[] body, OutputStream out) throws IOException {
        String target = headers.get("x-target");
        if (target == null || !target.startsWith("http")) {
            writeText(out, 400, "missing x-target");
            return;
        }
        HttpURLConnection conn = (HttpURLConnection) new URL(target).openConnection();
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(300000);
        conn.setRequestProperty("content-type", "application/json");
        conn.setRequestProperty("accept", "text/event-stream");
        String auth = headers.get("authorization");
        if (auth != null) conn.setRequestProperty("authorization", auth);
        conn.getOutputStream().write(body);
        int code = conn.getResponseCode();
        String ct = conn.getContentType();
        if (ct == null) ct = "text/event-stream; charset=utf-8";
        String respHead = "HTTP/1.1 " + code + " OK\r\n"
                + "content-type: " + ct + "\r\n"
                + "cache-control: no-cache\r\n"
                + "connection: close\r\n\r\n";
        out.write(respHead.getBytes(StandardCharsets.UTF_8));
        InputStream is = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
        if (is == null) {
            out.flush();
            return;
        }
        byte[] buf = new byte[4096];
        int n;
        while ((n = is.read(buf)) > 0) {
            out.write(buf, 0, n);
            out.flush();
        }
        is.close();
    }

    private void serve(String path, OutputStream out) throws IOException {
        if (path.equals("/") || path.isEmpty()) path = "/index.html";
        String asset = "www" + path;
        InputStream is;
        try {
            is = ctx.getAssets().open(asset);
        } catch (IOException e) {
            writeText(out, 404, "not found");
            return;
        }
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] tmp = new byte[8192];
        int n;
        while ((n = is.read(tmp)) > 0) buf.write(tmp, 0, n);
        is.close();
        byte[] data = buf.toByteArray();
        String mime = mimeOf(path);
        String head = "HTTP/1.1 200 OK\r\n"
                + "content-type: " + mime + "\r\n"
                + "content-length: " + data.length + "\r\n"
                + "cache-control: no-cache\r\n"
                + "connection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.UTF_8));
        out.write(data);
    }

    private String mimeOf(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html; charset=utf-8";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "text/javascript; charset=utf-8";
        if (p.endsWith(".css")) return "text/css; charset=utf-8";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json; charset=utf-8";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".ttf")) return "font/ttf";
        if (p.endsWith(".bcmap")) return "application/octet-stream";
        if (p.endsWith(".wasm")) return "application/wasm";
        return "application/octet-stream";
    }

    private void writeText(OutputStream out, int code, String text) throws IOException {
        byte[] b = text.getBytes(StandardCharsets.UTF_8);
        String head = "HTTP/1.1 " + code + " OK\r\ncontent-type: text/plain; charset=utf-8\r\n"
                + "content-length: " + b.length + "\r\nconnection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.UTF_8));
        out.write(b);
    }
}
