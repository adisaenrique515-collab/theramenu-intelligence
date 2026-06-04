import urllib.request, json, sys, time

base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"

endpoints = [
    "/recipes",
    "/recipes/search?cuisine=french",
    "/recipes/search?ingredient=chicken",
    "/recipes/search?category=Stew",
    "/ingredients",
    "/scores/top-commercial",
    "/scores/top-catering",
    "/scores/top-ghost-kitchen",
    "/scores/top-productization",
    "/concepts",
    "/concepts/safari-lounge",
    "/concepts/scarcity-drops",
]

ok = fail = 0
for ep in endpoints:
    try:
        with urllib.request.urlopen(base + ep, timeout=5) as r:
            data = json.loads(r.read())
            n = len(data) if isinstance(data, list) else "obj"
            print(f"  OK  {r.status} | {ep} | n={n}")
            ok += 1
    except Exception as e:
        print(f"  FAIL | {ep} | {e}")
        fail += 1

# sub-route tests
try:
    with urllib.request.urlopen(base + "/recipes?limit=1", timeout=5) as r:
        rlist = json.loads(r.read())
    rid = rlist[0]["id"]
    for sub in ["", "/ingredients", "/steps"]:
        try:
            with urllib.request.urlopen(base + f"/recipes/{rid}{sub}", timeout=5) as r:
                data = json.loads(r.read())
                n = len(data) if isinstance(data, list) else "obj"
                print(f"  OK  {r.status} | /recipes/{{id}}{sub} | n={n}")
                ok += 1
        except Exception as e:
            print(f"  FAIL | /recipes/{{id}}{sub} | {e}")
            fail += 1
except Exception as e:
    print(f"  FAIL getting recipe id: {e}")
    fail += 1

print(f"\n  Passed: {ok}  Failed: {fail}")
