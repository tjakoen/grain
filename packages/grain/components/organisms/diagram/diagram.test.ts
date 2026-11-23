// grain/components/organisms/diagram/diagram.test.ts: the diagram organism's geometry and renderers.
import { test, expect, describe } from "bun:test";
import {
  edgePoint, layers, orderByConnection, LabelPlacer, overlaps, dfdColumns,
  erdDiagram, dfdDiagram, layeredDiagram, crowsFoot, type DfdInput, type Box,
} from "./diagram.ts";

const xOf = (svg: string, id: string) => Number(svg.match(new RegExp(`data-node="${id}"[^>]*>(?:<title>[^<]*</title>)?<rect[^>]* x="([\\d.]+)"`))?.[1]);

describe("geometry", () => {
  test("a line leaves a box at its edge, and a diamond at its slanted side", () => {
    const b: Box = { id: "b", x: 0, y: 0, w: 100, h: 40 };
    expect(edgePoint(b, 200, 20)).toEqual([100, 20]);
    expect(edgePoint(b, 50, 100)).toEqual([50, 40]);
    const [x, y] = edgePoint(b, 100, 40, "diamond");
    expect(x / 50 + y / 20).toBeCloseTo(3, 5);
  });

  test("layers follow the longest path and a cycle stays bounded", () => {
    expect(layers(["a", "b", "c"], [["a", "b"], ["b", "c"], ["a", "c"]])).toEqual([["a"], ["b"], ["c"]]);
    expect(layers(["a", "b"], [["a", "b"], ["b", "a"]]).flat().sort()).toEqual(["a", "b"]);
  });

  test("ordering by connection uncrosses two parallel edges", () => {
    const out = orderByConnection([["a", "b"], ["y", "x"]], [["a", "x"], ["b", "y"]]);
    expect(out[1]).toEqual(["x", "y"]);
  });

  test("a label steps away from one already placed", () => {
    const p = new LabelPlacer();
    const one = p.place(50, 50, "first label")!, two = p.place(50, 50, "second label")!;
    expect(overlaps(one, two)).toBe(false);
    expect(p.svg()).toContain("second label");
  });

  test("text is escaped", () => {
    const p = new LabelPlacer();
    p.place(0, 0, "<a & b>");
    expect(p.svg()).toContain("&lt;a &amp; b&gt;");
  });

  test("crow's-foot ends draw the shape the cardinality names", () => {
    expect(crowsFoot.many(0, 0, 1)).toContain("<path");
    expect(crowsFoot.exactlyOne(0, 0, 1).match(/<line/g)).toHaveLength(2);
    expect(crowsFoot.zeroOrOne(0, 0, -1)).toContain("<circle");
  });
});

// The case that motivated ordering by connection: a visitor posts to a function in the second
// boundary, and the first boundary sat between them.
const avero: DfdInput = {
  nodes: [
    { id: "visitor", kind: "external", label: "Website visitor" },
    { id: "staff", kind: "external", label: "Staff" },
    { id: "client", kind: "external", label: "Client member" },
    { id: "book", kind: "process", label: "Book function", boundary: "supabase" },
    { id: "portal", kind: "process", label: "Client page", boundary: "browser" },
    { id: "bookings", kind: "store", label: "Bookings table", boundary: "supabase" },
    { id: "clients", kind: "store", label: "Client tables", boundary: "supabase" },
  ],
  boundaries: [{ id: "browser", label: "The user's browser" }, { id: "supabase", label: "Supabase project" }],
  flows: [
    { id: "f1", from: "visitor", to: "book", label: "Visitor sends a request" },
    { id: "f2", from: "book", to: "bookings" },
    { id: "f3", from: "clients", to: "portal" },
    { id: "f4", from: "staff", to: "clients" },
    { id: "f5", from: "client", to: "portal" },
  ],
};

describe("DFD layout", () => {
  test("no flow passes through a boundary it does not touch", () => {
    const { slots, side } = dfdColumns(avero);
    expect(side.get("visitor")).toBe("right");
    expect(side.get("client")).toBe("left");
    const order = slots.map((s) => s.boundary?.id ?? s.side);
    expect(order).toEqual(["left", "browser", "supabase", "right"]);
  });

  test("the visitor sits beyond the Book function, not across the browser", () => {
    const svg = dfdDiagram(avero);
    expect(xOf(svg, "visitor")).toBeGreaterThan(xOf(svg, "book"));
    expect(xOf(svg, "portal")).toBeLessThan(xOf(svg, "book"));
    expect(svg).toContain('data-ends="visitor book"');
    expect(svg).toContain("P1");
    expect(svg).toContain("D1");
  });
});

describe("renderers", () => {
  test("the ERD puts a referenced table left of its child and draws its notation", () => {
    const svg = erdDiagram({
      entities: [
        { id: "child", columns: [{ name: "id", pk: true }, { name: "parent_id", fk: true, nullable: true }], href: "/t/child" },
        { id: "parent", columns: [{ name: "id", pk: true }], tag: "RLS" },
      ],
      relations: [{ id: "r1", from: "child", to: "parent", fromColumn: "parent_id", toColumn: "id", optional: true, toEnd: "zero-or-one" }],
      selected: "child",
    });
    expect(xOf(svg, "parent")).toBeLessThan(xOf(svg, "child"));
    expect(svg).toContain('href="/t/child"');
    expect(svg).toContain("dg-optional");
    expect(svg).toContain("<circle");
    expect(svg).toContain(">RLS<");
    expect(svg).toContain("is-selected");
    expect(svg).toContain('class="diagram"');
  });

  test("a layered diagram draws each kind's shape and the group scope", () => {
    const svg = layeredDiagram({
      kind: "c4-containers", label: "C4", group: { label: "Avero", members: ["web"] },
      nodes: [
        { id: "u", kind: "person", label: "User" },
        { id: "web", kind: "container", label: "Web", sub: "[Bun]" },
        { id: "ok", kind: "decision", label: "Ok?" },
      ],
      edges: [{ from: "u", to: "web", label: "Uses" }, { from: "web", to: "ok" }],
    });
    expect(svg).toContain("dg-k-person");
    expect(svg).toContain("<circle");
    expect(svg).toContain("dg-boundary");
    expect(svg).toContain("[Bun]");
    expect(svg).toContain(">Uses<");
  });
});

describe("zoom asks for a modifier", () => {
  test("a plain wheel scrolls the page; only Ctrl or Cmd and the wheel, or a pinch, zooms", async () => {
    const { DIAGRAM_SCRIPT, diagramFrame } = await import("./diagram.ts");
    expect(DIAGRAM_SCRIPT).toContain("if (!ev.ctrlKey && !ev.metaKey) return;");
    expect(diagramFrame({ kind: "flow", width: 10, height: 10, label: "x" }, "")).toContain("Ctrl and scroll, or pinch, to zoom");
  });
});
