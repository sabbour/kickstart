---
'@aks-kickstart/web': patch
---

Fix Playground Workspace: "black void" below file content is gone. Applied min-height:0 to the flex chain (panel-workspace → PlaygroundWorkspace.body → viewerWrapper → FileViewer.rootFill) so the editor pane fills the viewport instead of collapsing to content-min-size and leaking the page-body background underneath (#997).
