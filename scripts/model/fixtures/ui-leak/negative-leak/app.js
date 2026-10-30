function renderMeta(ex, prof) {
  var rows = [];
  rows.push([label.id, esc(ex.id)]);
  rows.push([label.grade, prof.evidence_grade]);
  el.textContent = prof.id;
}
