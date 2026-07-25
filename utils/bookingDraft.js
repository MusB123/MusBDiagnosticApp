let draft = {
  address: '',
  zipCode: '',
  latitude: null,
  longitude: null,
  useGps: false,
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
    latitude: null,
    longitude: null,
    useGps: false,
    selectedTestsData: [],
    testsTotal: 0,
    doctorOrder: 'self',
    prescriptionFile: null,
  };
}

// Clears everything EXCEPT address/location — used right after a
// successful booking so the next visit to BookMobileVisit starts
// fresh (no leftover tests/schedule/insurance), while the address
// the patient already entered on Home stays untouched.
export function resetBookingDetailsKeepAddress() {
  draft = {
    ...draft,
    selectedTestsData: [],
    testsTotal: 0,
    appliedOffer: null,
    extraTestsData: [],
    schedule: null,
    doctorOrder: 'self',
    prescriptionFile: null,
    insurance: 'none',
    insuranceFront: null,
    insuranceBack: null,
  };
}