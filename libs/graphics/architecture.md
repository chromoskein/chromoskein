The 

Low level structures
- Triangle mesh
- Sphere
- Cylinder
- Box
- Quadratic Bezier

High level structures
- Sphere
- Cylinder
- Quadratic Bezier
  - Split into multiple quadratics
- Cubic Bezier
  - Approximated by quadratic beziers
- Polygonal mesh
  - Triangulated

High level structure interface:
```TypeScript
interface HighLevelStructure {
    get countOf(type: LowLevelStructure): number;
    get lowLevelStructures(type: LowLevelStructure): Array<LowLevelStructure>;
}
```

```TypeScript
interface LowLevelStructureType {
    Sphere,
    Cylinder,
    QuadraticBezier,
    TriangleMesh,
}
```

Algorithms for:
- Defragment
- Sort

Create buffer of low level structures
```TypeScript
let lowLevelStructureTypes = enumKeys(LowLevelStructure)
let lowLevelStructureCounts: Array<number> = new Array(lowLevelStructureTypes.length);

for(structure of highLevelStructures) {
    for (const lowLevelStructureType of lowLevelStructureTypes) {
        lowLevelStructureCounts[lowLevelStructureType] += structure.numberOf(lowLevelStructureType);
    }
}

for(structure of highLevelStructures) {
    for (const lowLevelStructureType of lowLevelStructureTypes) {
        lowLevelStructureCounts[lowLevelStructureType] += structure.numberOf(lowLevelStructureType);
    }
}

```

Rasterize
```
```