#!/usr/bin/env python3
"""Add a Routing button and panel to a cloned herdr `tabs` mod and `main` layout.

usage: patch.py <tabs-main.js> <layout.json> <tabs-mod-name>
"""
import json, sys

tabs_js, layout_json, tabs_name = sys.argv[1:4]

s = open(tabs_js).read()
if 'panelButton("routing"' not in s:
    a = 'const enabled = shared("workspace.panels") ?? ["files", "changes"];'
    b = '.when(w?.buttons, el => el.child(button("minimize"'
    assert a in s and b in s, "tabs mod is not the shape this patch expects"
    s = s.replace(a, 'const enabled = [...(shared("workspace.panels") ?? ["files", "changes"]), "routing"];')
    s = s.replace(b, '.child(panelButton("routing", "Routing", "mods/routing/bird.svg"))\n      ' + b, 1)
    open(tabs_js, "w").write(s)

d = json.load(open(layout_json))
found = {"tabs": False, "panel": False}
def walk(n):
    if n.get("id") == "tabs":
        n["content"]["mod"] = tabs_name; found["tabs"] = True
    if n.get("id") == "panel-body":
        if not any(c.get("id") == "routing" for c in n["children"]):
            n["children"].append({"id": "routing", "type": "block", "content": {"mod": "routing"}})
        found["panel"] = True
    for k in n.get("children", []): walk(k)
walk(d.get("root", d))
assert all(found.values()), "layout has no tabs block or panel-body stack"
json.dump(d, open(layout_json, "w"), indent=2)
