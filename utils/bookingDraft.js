// utils/bookingDraft.js
// A simple in-memory store for in-progress booking data that needs to
// survive across screen navigations without depending on route.params
// or component mount/remount timing.

let draft = {
  address: '',
  selectedTestsData: [],
  testsTotal: 0,
};

export function getBookingDraft() {
  return draft;
}

export function setBookingDraft(updates) {
  draft = { ...draft, ...updates };
}

export function resetBookingDraft() {
  draft = {
    address: '',
    selectedTestsData: [],
    testsTotal: 0,
  };
}