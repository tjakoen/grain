# Diagram

Planning diagrams drawn as inline SVG on the server, each in its method's own notation:
crow's-foot for an entity relationship diagram, Gane and Sarson for a data flow diagram with
trust boundaries, C4 for context and container views, and a flowchart for a user flow. Every
node and edge can be a link, and the frame gives pan, zoom and hover tracing with no library.

The palette is closed. Colour comes from the semantic tokens, so state is shown by line weight,
dashes and words: a heavy outline marks the system in scope or a flow's end, a dashed outline
marks something outside the scope, and an emphasised flow says why in its title.

diagram.ts has three layers, and a consumer can stop at any of them. The geometry (textWidth,
edgePoint, layers, orderByConnection, LabelPlacer) places things. The notation shapes (crowsFoot,
ganeSarson, c4, flowchart, boundary, arrow) each return one symbol. The renderers (erdDiagram,
dfdDiagram, layeredDiagram) take plain data and return a whole diagram inside diagramFrame. A page
that shows a diagram includes DIAGRAM_SCRIPT once.

The DFD keeps each trust boundary contiguous, then orders the boundaries so that no flow passes
through a boundary it does not touch, puts each external entity on the outer edge nearer to what
it talks to, and orders every column by connection.

## A small flow
```html
<figure class="diagram" data-diagram="flow">
  <svg class="diagram__svg" viewBox="0 0 260 150" role="img" aria-label="A two-step flow">
    <g class="dg-edges"><g class="dg-edge" data-edge="a-b" data-ends="a b"><path class="dg-line" d="M130,58 L130,92"></path></g></g>
    <g class="dg-nodes">
      <g class="dg-node" data-node="a"><rect class="dg-box" x="40" y="10" width="180" height="48" rx="24"></rect><text class="dg-title" x="130" y="39" text-anchor="middle">Open the link</text></g>
      <g class="dg-node" data-node="b"><rect class="dg-box dg-heavy" x="40" y="92" width="180" height="48" rx="24"></rect><text class="dg-title" x="130" y="121" text-anchor="middle">See the page</text></g>
    </g>
  </svg>
</figure>
```
