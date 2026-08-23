'use strict';
const app=document.querySelector('#app');
const IS_PAGES=location.hostname.endsWith('github.io');
const BASE=IS_PAGES?'/AniNexus':'';
const TZ='America/Sao_Paulo';
const GQL='https://graphql.'+'anilist.co';
const state={theme:localStorage.getItem('aninexus:theme')||'dark',favorites:new Set(JSON.parse(localStorage.getItem('aninexus:favorites')||'[]')),alerts:new Set(JSON.parse(localStorage.getItem('aninexus:alerts')||'[]')),list:new Map(JSON.parse(localStorage.getItem('aninexus:list')||'[]')),searchType:'ANIME',schedule:null,scheduleHash:'',scheduleTimer:null,countdownTimer:null,activeDay:null,catalog:{page:1,search:'',genre:'',format:'',sort:'POPULAR'},season:null,reading:{page:1,format:'MANGA'},awardsYear:2026,newsFilter:'TODAS'};

const ICON={
 home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3.5 10.8 12 3.7l8.5 7.1"/><path d="M5.7 9.8v10h12.6v-10M9.5 19.8v-6h5v6"/></svg>',
 grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>',
 calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M8 3.5v4M16 3.5v4M3.5 9.5h17"/></svg>',
 season:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19c4.5-1 6.8-3.4 7-7.1C7.6 12 5.2 10.7 4 8.2c4.3-1.6 7.2-.6 8.8 3 1.2-3.7 3.7-5.8 7.2-6.2.2 5.2-2.2 8.2-7.1 9.1-.5 2.9-2.1 5-4.9 6.4"/></svg>',
 sparkles:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3ZM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"/></svg>',
 search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 4.2 4.2"/></svg>',
 moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8 8.8 8.8 0 1 0 20.2 15.2Z"/></svg>',
 sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
 arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M14 7l5 5-5 5"/></svg>',
 menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
 close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="m6 6 12 12M18 6 6 18"/></svg>',
 heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.8 8.7c0 5-8.8 10.2-8.8 10.2S3.2 13.7 3.2 8.7A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.8 2.4Z"/></svg>',
 plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
 star:'<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
 left:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m14.5 6-6 6 6 6"/></svg>',right:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9.5 6 6 6-6 6"/></svg>',
 trophy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 4h8v4c0 4-1.7 7-4 7s-4-3-4-7V4Z"/><path d="M8 6H4v2c0 2.5 1.6 4 4.3 4M16 6h4v2c0 2.5-1.6 4-4.3 4M12 15v4M8 21h8"/></svg>',
 book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4.5c3.5-.8 6.2-.2 8 1.7v14c-1.8-1.9-4.5-2.5-8-1.7v-14Z"/><path d="M20 4.5c-3.5-.8-6.2-.2-8 1.7v14c1.8-1.9 4.5-2.5 8-1.7v-14Z"/></svg>',
 novel:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>',
 list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>',
 medal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="14" r="5"/><path d="m9 3 3 6 3-6M7 3h10"/><path d="m12 11 1 2 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3 1-2Z"/></svg>',
 snow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2v20M4.2 6.5l15.6 11M19.8 6.5l-15.6 11M8 4l4 2.5L16 4M8 20l4-2.5 4 2.5M4.5 10.5 8.8 12l-4.3 1.5M19.5 10.5 15.2 12l4.3 1.5"/></svg>',
 flower:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="2.2"/><path d="M12 9c-3-1-4.2-3.7-2.5-5.2C11.1 2.4 13 4.2 12 9ZM15 12c1-3 3.7-4.2 5.2-2.5 1.4 1.6-.4 3.5-5.2 2.5ZM12 15c3 1 4.2 3.7 2.5 5.2-1.6 1.4-3.5-.4-2.5-5.2ZM9 12c-1 3-3.7 4.2-5.2 2.5C2.4 12.9 4.2 11 9 12Z"/></svg>',
 sunshine:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>',
 leaf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 4C11 4 5 8.3 5 15c0 3 2 5 5 5 6.6 0 10-7.6 10-16Z"/><path d="M4 21c4-6 8-9 13-12"/></svg>',
 tv:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="13" rx="2"/><path d="m9 21 3-3 3 3"/></svg>',
 film:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>',
 bolt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/></svg>',
 fire:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2c1 4-2 5-1 8 1.5-2 3-2.5 4-5 3 3 5 6 5 10a9 9 0 1 1-18 0c0-4 2-7 5-10 0 3 1 4 2 5 0-3 1-5 3-8Z"/></svg>',
 crown:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 7 4 4 5-7 5 7 4-4-2 11H5L3 7Z"/><path d="M6 21h12"/></svg>',
 clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
 info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>',
 share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>',
 play:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8Z"/></svg>',
 user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.4 3.4-6.5 8-6.5s7.2 2.1 8 6.5"/></svg>',
 building:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 21V5l8-3 8 3v16M2 21h20M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/></svg>',
 instagram:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.7" r=".8" fill="currentColor" stroke="none"/></svg>',
 tiktok:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3v11.2a4.7 4.7 0 1 1-4-4.65"/><path d="M14 3c.7 3.2 2.4 4.8 5 5"/></svg>',
 news:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
 comment:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16v11H9l-5 4V5Z"/></svg>',
 bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3V9Z"/><path d="M10 20h4"/></svg>',
 edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',
 shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 20 6v5c0 5-3.2 8.3-8 10-4.8-1.7-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-5"/></svg>',
 rss:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="18" r="1.5" fill="currentColor"/><path d="M4 10a10 10 0 0 1 10 10M4 4a16 16 0 0 1 16 16"/></svg>'
};
