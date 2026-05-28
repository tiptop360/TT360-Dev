/*
 * <details-modal> — toggles .detail-modal.active on click.
 * Re-added 2026-05-28: was stripped from theme.s.min.js during a perf pass,
 * which broke the header search icon (snippets/header-search.liquid).
 */
class DetailsModal extends HTMLElement {
  constructor() {
    super();
    this.inner = this.querySelector('.detail-modal') || this;
    this.toggle = this.querySelector('.modal__toggle, [aria-haspopup="dialog"]');
    this.closeBtn = this.querySelector('.modal__close-button, .search-modal__close-button');
    this.overlays = this.querySelectorAll('.modal-overlay');
    this.input = this.querySelector('input[type="search"]');
    if (!this.toggle) return;
    this.toggle.addEventListener('click', this.onToggleClick.bind(this));
    if (this.closeBtn) this.closeBtn.addEventListener('click', this.close.bind(this));
    this.overlays.forEach(o => o.addEventListener('click', this.close.bind(this)));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.isOpen()) this.close();
    });
  }
  isOpen() { return this.inner.classList.contains('active'); }
  onToggleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    this.isOpen() ? this.close() : this.open();
  }
  open() {
    this.inner.classList.add('active');
    this.toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('overflow-hidden');
    if (this.input) setTimeout(() => this.input.focus(), 60);
  }
  close() {
    this.inner.classList.remove('active');
    this.toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('overflow-hidden');
  }
}
if (!customElements.get('details-modal')) {
  customElements.define('details-modal', DetailsModal);
}
