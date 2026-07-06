let draft = {
  address: '',
  zipCode: '',
  selectedTestsData: [],
  testsTotal: 0,
  doctorOrder: 'self',
  prescriptionFile: null,
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
    zipCode: '',
    selectedTestsData: [],
    testsTotal: 0,
    doctorOrder: 'self',
    prescriptionFile: null,
  };
}