$ErrorActionPreference='Stop'
$app = New-Object -ComObject PowerPoint.Application
try {
  $pres = $app.Presentations.Add()
  $slide = $pres.Slides.Add(1, 1)
  $slide.Shapes.Title.TextFrame.TextRange.Text = 'DocTree PPT Test'
  $box = $slide.Shapes.AddTextbox(1, 80, 120, 500, 120)
  $box.TextFrame.TextRange.Text = 'This slide has an image-friendly layout.'
  $pres.SaveAs('C:\Users\wangk\Desktop\大肥鱼的家\doc-tree\scripts\fixture-real.pptx', 24)
  $pres.SaveAs('C:\Users\wangk\Desktop\大肥鱼的家\doc-tree\scripts\fixture-real.ppt', 1)
  $pres.Close()
} finally { $app.Quit() }
