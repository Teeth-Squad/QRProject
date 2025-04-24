import qrcode

items = ["Toothpaste A"]

for item in items:
    img = qrcode.make(item)
    img.save(f"{item.replace(' ', '_')}.png")