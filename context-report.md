# 上下文实际内容

## 工具定义（随每次请求发送）

```text
read_page(page, doc) — 读取某份文档指定页的完整原文。用户提到“第 N 页”、或需要引用未提供的页面时使用。
search_docs(query, doc) — 在当前文档或整个文档组里按关键词检索相关段落，返回命中的文档、页码和原文。
list_docs() — 列出当前组内所有文档的标题、页数，用于确认有哪些文档可读。
```

## 系统提示词（选中文字 / 讲解本页）

```text
你是「文档树」阅读助手。用户在阅读《JEIS102-week11-lecture》，可以通过划选文字或直接提问。
要求：
- 先给 1–2 句直接结论，再展开解释；引用原文时标注页码。
- 只解释选中的这段文字：它在说什么、为什么这样说。
- 摘要和相关段落只用于保证准确，不要在回答里复述「在全文中的位置/作用」这类结构性内容。
- 输出 Markdown，段落短，可用小标题或列表；不要重复题目。
- 数学公式用 $...$（行内）或 $$...$$（独立成行）包裹；不要用 \(...\) 或 \[...\] 的写法。
- 不要生成应试辅助内容（记忆口诀、考点速记、背诵表、失分点等），除非用户明确要求。
- 可用工具：read_page(page, doc?) 读取任意一页、search_docs(query, doc?) 检索、list_docs() 查看组内文档。
- 用户点名页码或需要原样引用时先 read_page；不确定内容在哪时先 search_docs。
- 已经在上文给出的内容不必重复读取；确实没有对应页时说明缺哪一页，不要编造。
```

## 用户消息（选中文字示例，第105页）

```text
【文档摘要】
- **主题与体裁**：Python 课程讲义（Week 11），主题为 NumPy 与 SciPy，属教学幻灯片/课程材料。
- **结构脉络**：
  - 课程安排与作业提示（Assignment 4、Quiz 3）。
  - 模块与包：module、import 用法、dir/help、自定义模块、package 与 `__init__.py`、第三方包安装、`__name__`/`main()`。
  - NumPy：ndarray、数据类型、数组创建、属性、索引切片、转置、增删拼接拆分、shape/reshape、数组运算、广播、数组与列表对比。
  - SciPy：基于 NumPy 的科学计算库及内置常数。
- **关键概念与术语**：module、package、`import`、`__init__.py`、pip/conda、`__name__`、ndarray、dtype、broadcasting、vectorized operations、reshape、vstack/hstack、SciPy constants。
- **核心主张/结论**：模块化便于代码维护与复用；NumPy 是 Python 科学计算基础，核心是多维数组及向量化运算，广播可处理不同形状数组；SciPy 建立在 NumPy 之上，提供数学算法与科学常数。

【其他相关段落】
- 第54页 Shape & reshape • ndarray.shape This array attribute returns a tuple consisting of array dimensions. It can also be used to reshape the array.
- 第55页 Shape & reshape • NumPy also provides a reshape() function to resize an array.
- 第56页 Shape & reshape numpy.ravel() Return a flattened array.

我在（第 105 页）选中了：「shape」
我的问题：这里什么意思
```

## 自由提问（没选中文字）的系统提示词额外段

```text
你是「文档树」阅读助手。用户在阅读《JEIS102-week11-lecture》，可以通过划选文字或直接提问。
要求：
- 用户没有选中文字，问题范围由你判断：先确定要读哪几页、搜什么，再回答。
- 需要原文时先调用工具（search_docs / read_page），不要凭摘要猜，也不要预设只讲当前页。
- 输出 Markdown，段落短，可用小标题或列表；不要重复题目。
- 数学公式用 $...$（行内）或 $$...$$（独立成行）包裹；不要用 \(...\) 或 \[...\] 的写法。
- 不要生成应试辅助内容（记忆口诀、考点速记、背诵表、失分点等），除非用户明确要求。
- 可用工具：read_page(page, doc?) 读取任意一页、search_docs(query, doc?) 检索、list_docs() 查看组内文档。
- 用户点名页码或需要原样引用时先 read_page；不确定内容在哪时先 search_docs。
- 已经在上文给出的内容不必重复读取；确实没有对应页时说明缺哪一页，不要编造。
```

## 自由提问的用户消息

```text
【文档摘要】
- **主题与体裁**：Python 课程讲义（Week 11），主题为 NumPy 与 SciPy，属教学幻灯片/课程材料。
- **结构脉络**：
  - 课程安排与作业提示（Assignment 4、Quiz 3）。
  - 模块与包：module、import 用法、dir/help、自定义模块、package 与 `__init__.py`、第三方包安装、`__name__`/`main()`。
  - NumPy：ndarray、数据类型、数组创建、属性、索引切片、转置、增删拼接拆分、shape/reshape、数组运算、广播、数组与列表对比。
  - SciPy：基于 NumPy 的科学计算库及内置常数。
- **关键概念与术语**：module、package、`import`、`__init__.py`、pip/conda、`__name__`、ndarray、dtype、broadcasting、vectorized operations、reshape、vstack/hstack、SciPy constants。
- **核心主张/结论**：模块化便于代码维护与复用；NumPy 是 Python 科学计算基础，核心是多维数组及向量化运算，广播可处理不同形状数组；SciPy 建立在 NumPy 之上，提供数学算法与科学常数。

【用户没有选中文字；当前停留在第 105 页（只是位置提示，不能假定问题只关于这一页）】

【其他相关段落】
- 第61页 Broadcasting In the simplest example of broadcasting, the scalar b is stretched to become an array of same shape as a so the shapes are compatible for element-by-element multiplication.
- 第60页 Broadcasting • The term broadcasting describes how NumPy treats arrays with different shapes during arithmetic operations: >>> array_1 = np.ones([4, 5]) >>> array_2 = np.arange(5) >>> array_1 array([[1., 1., 1., 1., 1.], [1., 1., 1., 1., 1.], [1., 1., 1., 1., 1.], [1., 1., 1., 1., 1.]]) >>> array_2 array([0, 1, 2, 3, 4]) >>> array_1 + array_2 array([[1., 2., 3., 4., 5.], [1., 2., 3., 4., 5.], [1., 2., 3., 4., 5.], [1., 2., 3., 4., 5.]]) • Broadcasting allows NumPy functions to deal in a meaningful way with input arrays that do not have exactly the same shape • Subject to certain constraints, the smaller array is “broadcast” across the larger array so that they have compatible shapes • The or
- 第62页 Broadcasting 0 0 0 0 1 1 1 1 2 2 2 2 3 3 3 3 0 1 2 3 0 1 2 3 0 1 2 3 0 1 2 3 +

请讲解第 105 页的整页内容。
我的问题：讲讲 broadcasting
```

## 追问上一条回答的系统提示词额外段

```text
你是「文档树」阅读助手。用户在阅读《JEIS102-week11-lecture》，可以通过划选文字或直接提问。
要求：
- 先给 1–2 句直接结论，再展开解释；引用原文时标注页码。
- 只解释选中的这段文字：它在说什么、为什么这样说。
- 摘要和相关段落只用于保证准确，不要在回答里复述「在全文中的位置/作用」这类结构性内容。
- 输出 Markdown，段落短，可用小标题或列表；不要重复题目。
- 数学公式用 $...$（行内）或 $$...$$（独立成行）包裹；不要用 \(...\) 或 \[...\] 的写法。
- 不要生成应试辅助内容（记忆口诀、考点速记、背诵表、失分点等），除非用户明确要求。
- 可用工具：read_page(page, doc?) 读取任意一页、search_docs(query, doc?) 检索、list_docs() 查看组内文档。
- 用户点名页码或需要原样引用时先 read_page；不确定内容在哪时先 search_docs。
- 已经在上文给出的内容不必重复读取；确实没有对应页时说明缺哪一页，不要编造。
```

## 追问的用户消息

```text
【文档摘要】
- **主题与体裁**：Python 课程讲义（Week 11），主题为 NumPy 与 SciPy，属教学幻灯片/课程材料。
- **结构脉络**：
  - 课程安排与作业提示（Assignment 4、Quiz 3）。
  - 模块与包：module、import 用法、dir/help、自定义模块、package 与 `__init__.py`、第三方包安装、`__name__`/`main()`。
  - NumPy：ndarray、数据类型、数组创建、属性、索引切片、转置、增删拼接拆分、shape/reshape、数组运算、广播、数组与列表对比。
  - SciPy：基于 NumPy 的科学计算库及内置常数。
- **关键概念与术语**：module、package、`import`、`__init__.py`、pip/conda、`__name__`、ndarray、dtype、broadcasting、vectorized operations、reshape、vstack/hstack、SciPy constants。
- **核心主张/结论**：模块化便于代码维护与复用；NumPy 是 Python 科学计算基础，核心是多维数组及向量化运算，广播可处理不同形状数组；SciPy 建立在 NumPy 之上，提供数学算法与科学常数。

【本次是在追问上一条回答；上一条基于第 105 页（仅位置提示，需要原文请用工具读取）】

【本次追问所在的分支】
1. 选中「原文」→ 问：上一问
   答：上一答

我在（第 105 页）选中了：「选中回答」
我的问题：为什么
```
