export function injectSorter(container: Element): void {
  if (document.querySelector(".ips-order-item")) return;
  const nativeToolbar = document.querySelector("#view-type-toolbar-buttons");
  if (!nativeToolbar) return;

  const original = [...container.children];
  const item = document.createElement("li");
  item.className = "ips-order-item";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn regular smaller ips-order-button";
  button.textContent = "Tu score";
  button.setAttribute("aria-label", "Ordenar por puntuación personal");
  item.append(button);

  const moreMenu = nativeToolbar.querySelector(":scope > li.dropdown-menu");
  nativeToolbar.insertBefore(item, moreMenu);

  button.addEventListener("click", () => {
    const cards = [...container.children];
    cards.sort((a, b) => Number((b as HTMLElement).dataset.ipsScore ?? -1) - Number((a as HTMLElement).dataset.ipsScore ?? -1)).forEach(card => container.append(card));
    nativeToolbar.querySelectorAll(".selected").forEach(control => control.classList.remove("selected"));
    button.classList.add("selected");
  });

  nativeToolbar.addEventListener("click", event => {
    const target = event.target as Element;
    if (target.closest(".ips-order-item")) return;
    button.classList.remove("selected");
    const control = target.closest<HTMLElement>("[data-value]");
    if (control?.dataset.value === "") original.forEach(card => container.append(card));
  });
}
