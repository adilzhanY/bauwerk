"""Validate Bauwerk IFC exports with IfcOpenShell: schema and EXPRESS rules, then
build every product's geometry and report triangle counts for walls with openings.

    python -m venv .venv && .venv/bin/pip install ifcopenshell pytest
    .venv/bin/python scripts/validate-ifc.py docs/example-house.ifc
"""
import sys

import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.validate

exit_code = 0
for path in sys.argv[1:]:
    f = ifcopenshell.open(path)
    print("==", path, "schema", f.schema)
    logger = ifcopenshell.validate.json_logger()
    ifcopenshell.validate.validate(f, logger, express_rules=True)
    issues = logger.statements
    print("validation issues:", len(issues))
    for i in issues[:20]:
        print("  ", i.get("level"), str(i.get("message")).replace("\n", " ")[:160])
    if issues:
        exit_code = 1
    counts = {}
    for e in f:
        counts[e.is_a()] = counts.get(e.is_a(), 0) + 1
    keys = ("IfcBuildingStorey", "IfcWall", "IfcOpeningElement", "IfcWindow", "IfcDoor", "IfcSpace", "IfcZone", "IfcSlab")
    print({k: counts.get(k, 0) for k in keys})
    settings = ifcopenshell.geom.settings()
    ok = fail = 0
    for e in f.by_type("IfcProduct"):
        if not e.Representation:
            continue
        try:
            ifcopenshell.geom.create_shape(settings, e)
            ok += 1
        except Exception as ex:  # noqa: BLE001
            fail += 1
            print("  geometry failed:", e.is_a(), e.Name, str(ex)[:120])
    print("geometry ok:", ok, "failed:", fail)
    if fail:
        exit_code = 1
    for w in f.by_type("IfcWall"):
        voids = [r for r in f.by_type("IfcRelVoidsElement") if r.RelatingBuildingElement == w]
        if voids:
            shape = ifcopenshell.geom.create_shape(settings, w)
            print("wall", w.Name, "with", len(voids), "openings has", len(shape.geometry.faces) // 3, "triangles (a plain box has 12)")
            break
    for s in f.by_type("IfcBuildingStorey"):
        spaces = len(s.IsDecomposedBy[0].RelatedObjects) if s.IsDecomposedBy else 0
        contained = sum(len(r.RelatedElements) for r in s.ContainsElements)
        print("storey", s.Name, "elevation", s.Elevation, "spaces", spaces, "elements", contained)
sys.exit(exit_code)
