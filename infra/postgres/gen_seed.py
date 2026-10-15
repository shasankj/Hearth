"""Generates 002_seed.sql deterministically. All addresses/people are FICTIONAL; city coordinates are real.
Run:  python3 infra/postgres/gen_seed.py > infra/postgres/002_seed.sql"""
import random

random.seed(2026)
CITIES = {
    "Boston": ("MA", 1.15, [("Back Bay", 42.3503, -71.0810, "02116"), ("South End", 42.3410, -71.0720, "02118"), ("Jamaica Plain", 42.3098, -71.1130, "02130"), ("Beacon Hill", 42.3588, -71.0707, "02108")]),
    "New York": ("NY", 1.6, [("Brooklyn Heights", 40.6958, -73.9936, "11201"), ("Upper West Side", 40.7870, -73.9754, "10024"), ("Astoria", 40.7644, -73.9235, "11102"), ("Harlem", 40.8116, -73.9465, "10027")]),
    "Austin": ("TX", 0.85, [("Zilker", 30.2640, -97.7700, "78704"), ("East Austin", 30.2620, -97.7180, "78702"), ("Mueller", 30.2980, -97.7050, "78723"), ("South Congress", 30.2480, -97.7500, "78704")]),
    "Seattle": ("WA", 1.2, [("Capitol Hill", 47.6253, -122.3222, "98102"), ("Ballard", 47.6685, -122.3840, "98107"), ("Fremont", 47.6513, -122.3499, "98103"), ("Queen Anne", 47.6370, -122.3570, "98109")]),
    "Denver": ("CO", 0.9, [("LoHi", 39.7600, -105.0110, "80211"), ("Washington Park", 39.7010, -104.9720, "80209"), ("RiNo", 39.7680, -104.9790, "80216")]),
    "Miami": ("FL", 1.1, [("Brickell", 25.7617, -80.1918, "33131"), ("Coral Gables", 25.7215, -80.2684, "33134"), ("Wynwood", 25.8010, -80.1990, "33127")]),
    "San Francisco": ("CA", 1.9, [("Mission", 37.7599, -122.4148, "94110"), ("Noe Valley", 37.7502, -122.4337, "94114"), ("Sunset", 37.7530, -122.4940, "94122")]),
    "Chicago": ("IL", 0.8, [("Lincoln Park", 41.9214, -87.6513, "60614"), ("Wicker Park", 41.9088, -87.6796, "60622"), ("Hyde Park", 41.7943, -87.5907, "60615")]),
}
STREETS = ["Maple", "Oak", "Cedar", "Willow", "Juniper", "Harbor", "Summit", "Lantern", "Orchard", "Birch", "Elm", "Sycamore", "Magnolia", "Granite", "Ember"]
SUFFIX = ["St", "Ave", "Ln", "Ct", "Pl", "Way", "Blvd"]
FEATURES = ["pool", "garage", "waterfront", "fireplace", "hardwood floors", "central AC", "in-unit laundry", "doorman", "rooftop deck", "pets allowed", "EV charger", "garden", "city view", "gym", "smart home", "finished basement"]
OPEN = ["Sun-drenched", "Beautifully renovated", "Charming", "Modern", "Light-filled", "Spacious", "Elegant", "Cozy", "Designer-finished", "Classic"]
TAIL = ["with an open kitchen made for hosting.", "steps from cafes, parks and transit.", "featuring generous closets and quiet bedrooms.", "with a private outdoor retreat.", "close to top-rated schools and trails.", "with original details and new systems."]
FIRST = ["Maya", "Jordan", "Priya", "Ethan", "Sofia", "Marcus", "Hannah", "Diego"]
LAST = ["Chen", "Alvarez", "Patel", "Brooks", "Nakamura", "Okafor", "Lindqvist", "Rossi"]
BROKERS = ["Hearth Realty", "Northgate Properties", "Lumen Homes", "Parkview & Co."]
TYPES = [("house", 0.3), ("condo", 0.35), ("townhouse", 0.2), ("multi_family", 0.1), ("land", 0.05)]


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def arr(items):
    return "ARRAY[" + ",".join(q(i) for i in items) + "]::text[]" if items else "'{}'::text[]"


def pick_type():
    r, acc = random.random(), 0
    for t, w in TYPES:
        acc += w
        if r < acc:
            return t
    return "condo"


def agents():
    out = []
    for i in range(8):
        name = f"{FIRST[i]} {LAST[i]}"
        email = f"{FIRST[i].lower()}.{LAST[i].lower()}@example.com"
        bio = f"{name} helps buyers and renters find homes they love, with a focus on clear advice and fast follow-up."
        out.append(f"({q('A-' + str(i + 1))},{q(name)},{q(random.choice(BROKERS))},{q('(555) 555-' + str(1000 + i * 37))},{q(email)},{q(bio)},{round(random.uniform(4.4, 5.0), 1)},{random.randint(40, 320)})")
    return "INSERT INTO agents (id,name,brokerage,phone,email,bio,rating,sales) VALUES\n" + ",\n".join(out) + ";\n"


def pick_status():
    return random.choices(["for_sale", "for_rent", "pending", "sold"], [58, 24, 8, 10])[0]


def rooms(ptype):
    if ptype == "land":
        return 0, 0, 0
    beds = random.choice([1, 1, 2, 2, 3, 3, 4, 5])
    baths = max(1, beds - random.choice([0, 0, 1])) + random.choice([0, 0.5])
    return beds, baths, int(450 + beds * random.uniform(330, 520))


def price_for(ptype, beds, mult, status):
    base = (260_000 if ptype == "land" else 520_000) * mult
    price = int(round(base * (0.55 + beds * 0.32) * random.uniform(0.85, 1.25), -3))
    return int(round(price * 0.0042, -1)) if status == "for_rent" and ptype != "land" else price


def pick_features(ptype):
    pool = ["waterfront", "garden", "city view"] if ptype == "land" else FEATURES
    return sorted(random.sample(pool, random.randint(1 if ptype == "land" else 2, min(len(pool), 6))))


def place(city):
    state, mult, hoods = CITIES[city]
    hood, lat, lng, zipc = random.choice(hoods)
    street = f"{random.randint(12, 980)} {random.choice(STREETS)} {random.choice(SUFFIX)}"
    jitter = lambda: random.uniform(-0.012, 0.012)
    return dict(state=state, mult=mult, hood=hood, zip=zipc, lat=round(lat + jitter(), 6), lng=round(lng + jitter(), 6), addr=street)


def listing(n, city):
    where, ptype, status = place(city), pick_type(), pick_status()
    beds, baths, sqft = rooms(ptype)
    return dict(where, id=f"H-{1000 + n}", status=status, ptype=ptype, city=city, price=price_for(ptype, beds, where["mult"], status),
                beds=beds, baths=baths, sqft=sqft, lot=0 if ptype == "condo" else random.randint(1500, 9000), year=random.randint(1925, 2024),
                hoa=random.choice([0, 0, 180, 320, 540]) if ptype in ("condo", "townhouse") else 0,
                desc=f"{random.choice(OPEN)} {ptype.replace('_', ' ')} in {where['hood']} {random.choice(TAIL)}", feats=pick_features(ptype),
                agent=f"A-{random.randint(1, 8)}", days=random.randint(1, 120),
                open=random.choice([None, None, None, random.randint(1, 6)]) if status == "for_sale" else None)


def insert(l):
    open_at = f"now() + interval '{l['open']} days'" if l["open"] else "NULL"
    head = f"({q(l['id'])},{q(l['status'])},{q(l['ptype'])},{q(l['addr'])},{q(l['city'])},{q(l['state'])},{q(l['zip'])},{q(l['hood'])},{l['lat']},{l['lng']},"
    mid = f"{l['price']},{l['beds']},{l['baths']},{l['sqft']},{l['lot']},{l['year']},{l['hoa']},{q(l['desc'])},{arr(l['feats'])},'{{}}'::text[],"
    return head + mid + f"{q(l['agent'])},now() - interval '{l['days']} days',{open_at})"


def starting_price(l):
    if l["status"] not in ("for_sale", "pending"):
        return l["price"]
    return int(l["price"] * random.choice([1.0, 1.0, 1.04, 1.08]))


def closing_events(l):
    if l["status"] == "pending":
        return [(l["id"], random.randint(0, 3), l["price"], "pending")]
    if l["status"] == "sold":
        return [(l["id"], random.randint(0, 5), int(l["price"] * random.uniform(0.96, 1.04)), "sold")]
    return []


def history(l):
    start = starting_price(l)
    rows = [(l["id"], l["days"], start, "listed")]
    if start != l["price"]:
        rows.append((l["id"], max(l["days"] - random.randint(1, 20), 0), l["price"], "price_change"))
    return rows + closing_events(l)


def emit_listings(items):
    print("INSERT INTO listings (id,status,property_type,address,city,state,zip,neighborhood,lat,lng,price_usd,beds,baths,sqft,lot_sqft,year_built,hoa_monthly,description,features,photos,agent_id,listed_at,open_house_at) VALUES")
    print(",\n".join(insert(l) for l in items) + ";\n")


def emit_history(items):
    rows = [r for l in items for r in history(l)]
    print("INSERT INTO price_history (listing_id,date,price_usd,event) VALUES")
    print(",\n".join(f"({q(i)},current_date - {d},{p},{q(e)})" for i, d, p, e in rows) + ";")


def main():
    print(agents())
    items = [listing(n, city) for n, city in enumerate([c for c in CITIES for _ in range(8)])]
    emit_listings(items)
    emit_history(items)


main()
