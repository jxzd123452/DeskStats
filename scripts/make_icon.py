"""Draw the DeskStats app icon."""

from PIL import Image, ImageDraw

SIZE = 1024
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)
draw.rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=224, fill=(14, 17, 24, 255))
overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)
od.ellipse((-180, -220, 620, 520), fill=(79, 140, 255, 56))
od.ellipse((520, -80, 1180, 560), fill=(167, 139, 250, 42))
img = Image.alpha_composite(img, overlay)
draw = ImageDraw.Draw(img)
points = [(180, 690), (300, 610), (390, 640), (500, 470), (620, 520), (760, 300), (860, 360)]
draw.line(points, fill=(79, 140, 255, 255), width=46, joint="curve")
draw.ellipse((820, 300, 900, 380), fill=(167, 139, 250, 255))
img.save("/tmp/deskstats-icon.png")
print("wrote /tmp/deskstats-icon.png")
