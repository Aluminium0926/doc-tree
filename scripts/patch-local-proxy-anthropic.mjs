import fs from 'node:fs'
const F = 'mobile/android/java/com/doctree/app/LocalServer.java'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  `        String auth = headers.get("authorization");
        if (auth != null) conn.setRequestProperty("authorization", auth);`,
  `        String auth = headers.get("authorization");
        if (auth != null) conn.setRequestProperty("authorization", auth);
        // Anthropic 用 x-api-key + anthropic-version，不能丢
        String apiKey = headers.get("x-api-key");
        if (apiKey != null) conn.setRequestProperty("x-api-key", apiKey);
        String anthropicVer = headers.get("anthropic-version");
        if (anthropicVer != null) conn.setRequestProperty("anthropic-version", anthropicVer);`
)
fs.writeFileSync(F, t)
console.log(t.includes('x-api-key') ? 'java ok' : 'not matched')
