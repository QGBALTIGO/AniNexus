'use strict';
(() => {
  if (window.__NX44_RAILS__) return;
  window.__NX44_RAILS__ = true;

  const RAIL_SELECTOR = '.nx35-home .nx35-rail,.nx38-impressions-home .nx38-impressions-rail';
  const controllers = new Set();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let railSequence = 0;
  let scanFrame = 0;

  function svgIcon(pathData, className) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.classList.add(className);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    path.setAttribute('d', pathData);
    svg.append(path);
    return svg;
  }

  function icon(target, direction) {
    const holder = document.createElement('span');
    holder.className = `nx44-rail-icon nx44-rail-icon--${direction}`;
    holder.setAttribute('aria-hidden', 'true');
    holder.append(svgIcon(direction === 'prev' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6', 'nx44-rail-chevron'));
    target.replaceChildren(holder);
  }

  function railTitle(rail) {
    const heading = rail.closest('section')?.querySelector('h2');
    return String(heading?.textContent || 'esta lista').replace(/\s+/g, ' ').trim();
  }

  function buttonFor(actions, direction, rail) {
    const existing = direction === 'prev'
      ? actions.querySelector('[data-nx44-rail-dir="prev"],[data-imp-prev]')
      : actions.querySelector('[data-nx44-rail-dir="next"],[data-imp-next]');
    const button = existing || document.createElement('button');
    button.type = 'button';
    button.classList.add('nx44-rail-button');
    button.dataset.nx44RailDir = direction;
    button.setAttribute('aria-controls', rail.id);
    if (!button.getAttribute('aria-label')) {
      const label = direction === 'prev' ? 'Itens anteriores' : 'Próximos itens';
      button.setAttribute('aria-label', `${label} de ${railTitle(rail)}`);
    }
    icon(button, direction);
    actions.insertBefore(button, actions.querySelector(':scope > a'));
    return button;
  }

  function tuneSectionLink(link) {
    if (!link || link.dataset.nx44RailLink) return;
    link.dataset.nx44RailLink = '1';
    link.classList.add('nx44-rail-link');
    link.querySelector('svg,[data-icon]')?.remove();
    const holder = document.createElement('span');
    holder.className = 'nx44-rail-link-icon';
    holder.setAttribute('aria-hidden', 'true');
    holder.append(svgIcon('M5 12h14m-5-5 5 5-5 5', 'nx44-rail-link-arrow'));
    link.append(holder);
  }

  function ensureFrame(rail) {
    let frame = rail.parentElement;
    if (!frame?.classList.contains('nx35-edge') && !frame?.classList.contains('nx44-rail-frame')) {
      frame = document.createElement('div');
      frame.className = 'nx44-rail-frame';
      rail.before(frame);
      frame.append(rail);
    }
    frame.classList.add('nx44-rail-frame');
    return frame;
  }

  function ensureActions(rail, frame) {
    const impressions = rail.classList.contains('nx38-impressions-rail');
    if (impressions) {
      const actions = rail.closest('.nx38-impressions-home')?.querySelector('.nx38-impressions-actions');
      if (actions) {
        actions.classList.add('nx44-rail-actions', 'nx44-rail-actions--impressions');
        tuneSectionLink(actions.querySelector('a'));
        return actions;
      }
    }

    const section = rail.closest('.nx35-section');
    const head = section?.querySelector('.nx35-head');
    if (section && head) {
      section.classList.add('nx44-has-rail');
      let actions = head.querySelector(':scope > .nx44-rail-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'nx44-rail-actions';
        head.append(actions);
      }
      const link = head.querySelector(':scope > a') || actions.querySelector(':scope > a');
      if (link) {
        tuneSectionLink(link);
        actions.append(link);
      }
      return actions;
    }

    let actions = frame.querySelector(':scope > .nx44-rail-actions--overlay');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'nx44-rail-actions nx44-rail-actions--overlay';
      frame.append(actions);
    }
    return actions;
  }

  function metrics(rail) {
    const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const left = Math.max(0, Math.min(max, rail.scrollLeft));
    return { max, left, overflow: max > 3 };
  }

  function scrollStep(rail) {
    const first = rail.firstElementChild;
    if (!first) {
      const distance = Math.max(240, rail.clientWidth * .82);
      return { distance, unit: distance };
    }
    const styles = getComputedStyle(rail);
    const gap = parseFloat(styles.columnGap || styles.gap) || 0;
    const itemWidth = first.getBoundingClientRect().width;
    const unit = Math.max(1, itemWidth + gap);
    const pageByVisibleItems = rail.classList.contains('nx35-rank-rail');
    const visibleItems = Math.max(1, (pageByVisibleItems ? Math.ceil : Math.floor)((rail.clientWidth + gap) / unit));
    return {
      distance: pageByVisibleItems ? unit * visibleItems : Math.min(rail.clientWidth, unit * visibleItems),
      unit
    };
  }

  function mountRail(rail) {
    if (!rail || rail.dataset.nx44RailMounted) return;
    rail.dataset.nx44RailMounted = '1';
    rail.id ||= `nx44Rail${++railSequence}`;
    rail.classList.add('nx44-rail');
    rail.tabIndex = 0;
    if (!rail.getAttribute('aria-label')) rail.setAttribute('aria-label', `Carrossel de ${railTitle(rail)}`);

    const frame = ensureFrame(rail);
    const actions = ensureActions(rail, frame);
    const previous = buttonFor(actions, 'prev', rail);
    const next = buttonFor(actions, 'next', rail);
    const overlay = actions.classList.contains('nx44-rail-actions--overlay');
    const keepStaticButtons = rail.classList.contains('nx38-impressions-rail');
    let updateFrame = 0;

    const update = () => {
      updateFrame = 0;
      const { max, left, overflow } = metrics(rail);
      const atStart = !overflow || left <= 3;
      const atEnd = !overflow || left >= max - 3;
      frame.dataset.nx44Left = !atStart ? '1' : '0';
      frame.dataset.nx44Right = !atEnd ? '1' : '0';
      frame.classList.toggle('is-overflowing', overflow);
      actions.classList.toggle('is-static', !overflow);
      previous.disabled = atStart;
      next.disabled = atEnd;
      previous.hidden = !overflow && !keepStaticButtons;
      next.hidden = !overflow && !keepStaticButtons;
      if (overlay) actions.hidden = !overflow;
    };
    const queueUpdate = () => {
      if (!updateFrame) updateFrame = requestAnimationFrame(update);
    };
    const move = direction => {
      const { max, left, overflow } = metrics(rail);
      if (!overflow) return;
      const { distance, unit } = scrollStep(rail);
      const raw = left + direction * distance;
      const target = Math.max(0, Math.min(max, Math.round(raw / unit) * unit));
      rail.scrollTo({ left: target, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    };

    previous.onclick = event => { event.preventDefault(); move(-1); };
    next.onclick = event => { event.preventDefault(); move(1); };
    const onKeydown = event => {
      if (event.target !== rail) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        move(event.key === 'ArrowLeft' ? -1 : 1);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        const { max } = metrics(rail);
        rail.scrollTo({ left: event.key === 'Home' ? 0 : max, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      }
    };

    rail.addEventListener('scroll', queueUpdate, { passive: true });
    rail.addEventListener('keydown', onKeydown);
    const resizeObserver = new ResizeObserver(queueUpdate);
    resizeObserver.observe(rail);
    const itemObserver = new MutationObserver(queueUpdate);
    itemObserver.observe(rail, { childList: true });
    queueUpdate();

    controllers.add({
      rail,
      destroy() {
        if (updateFrame) cancelAnimationFrame(updateFrame);
        resizeObserver.disconnect();
        itemObserver.disconnect();
        rail.removeEventListener('scroll', queueUpdate);
        rail.removeEventListener('keydown', onKeydown);
        previous.onclick = null;
        next.onclick = null;
      }
    });
  }

  function scan() {
    scanFrame = 0;
    for (const controller of [...controllers]) {
      if (controller.rail.isConnected) continue;
      controller.destroy();
      controllers.delete(controller);
    }
    document.querySelectorAll(RAIL_SELECTOR).forEach(mountRail);
  }

  function scheduleScan() {
    if (!scanFrame) scanFrame = requestAnimationFrame(scan);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('aninexus:home-v34-ready', scheduleScan);
  addEventListener('aninexus:route-ready', scheduleScan);
  window.AniNexusRails = Object.freeze({ refresh: scheduleScan });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleScan, { once: true });
  else scheduleScan();
})();
