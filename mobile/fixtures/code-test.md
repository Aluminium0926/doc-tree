# 代码块渲染测试

下面是一段 Python，用来验证异常处理的分支：

```python
try:
    print("1. 开始执行 try")
    x = 10 / 2
except ZeroDivisionError:
    print("2. 发生了除零错误")
else:
    print("3. 没报错，我才会执行")
finally:
    print("4. 无论报不报错，我必执行")
```

类与实例：

```python
class Person:
    def __init__(self, name, idnumber):
        self.name = name
        self.idnumber = idnumber

    def display(self):
        print(self.name)
        print(self.idnumber)
```

其他语言：

```javascript
const cache = new Map()
async function getDoc(id) {
  if (cache.has(id)) return cache.get(id)
  const res = await fetch(`/api/doc/${id}`)
  const data = await res.json()
  cache.set(id, data)
  return data
}
```

行内代码：`self.name` 是实例属性，`__init__` 是构造器。

```bash
npm install
npm start
```
