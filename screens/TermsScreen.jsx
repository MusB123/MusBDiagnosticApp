import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */
const NAVY = '#0A1F5C';
const BRAND = '#00A0E4';
const ACCENTS = ['#00A0E4', '#6C5CE7', '#00B894', '#FF7A59', '#FDBA31', '#0A84FF'];

/* ------------------------------------------------------------------ */
/*  Content data                                                       */
/* ------------------------------------------------------------------ */
const termsIntro = {
  meta: 'MusB Phle Mobile App\nMusB Diagnostics / MusB Labs — a division of MusB Research LLC\nEffective: July 2026  |  Last Updated: July 2026',
  body:
    'These Terms and Conditions ("Terms") govern your download, installation, and use of the MusB Phle mobile application ("App") operated by MusB Research LLC doing business as MusB Diagnostics / MusB Labs and MusB Labs ("Company," "we," "us," or "our"). The App facilitates phlebotomy appointment scheduling, clinical diagnostic testing, clinical research recruitment, and health and wellness features. By downloading or using the App, you agree to be bound by these Terms and our Privacy Policy. If you do not agree, do not download or use the App.',
};

const termsSections = [
  {
    number: 1,
    icon: 'person-outline',
    title: 'Eligibility',
    blocks: [
      { type: 'p', text: 'You must be at least 18 years old and legally capable of entering into a binding contract to create an account and use the App. If you are enrolling as a parent or legal guardian on behalf of a minor for a specific clinical study or diagnostic service, you represent that you have the legal authority to consent on that minor\u2019s behalf and that any minor-specific enrollment complies with applicable pediatric research regulations.' },
    ],
  },
  {
    number: 2,
    icon: 'apps-outline',
    title: 'Description of Services',
    blocks: [
      { type: 'p', text: 'The App may provide:' },
      {
        type: 'bullets',
        items: [
          'Phlebotomy Services: scheduling and managing mobile or in-office phlebotomy appointments, specimen collection coordination, and related logistics',
          'Diagnostic Services: ordering, scheduling, and receiving results of laboratory or diagnostic tests facilitated through affiliated licensed providers and accredited laboratories',
          'Clinical Research Services: information about clinical studies, eligibility pre-screening, and participant support (actual participation requires a separate, IRB-approved informed consent)',
          'Health Tracking and Wellness Features: tools to log symptoms, vitals, activity, or other health metrics and receive general informational content',
        ],
      },
    ],
  },
  {
    number: 3,
    icon: 'medkit-outline',
    title: 'Not a Substitute for Medical Care',
    highlight: true,
    blocks: [
      { type: 'p', text: 'THE APP AND ITS CONTENT ARE NOT A SUBSTITUTE FOR PROFESSIONAL MEDICAL ADVICE, DIAGNOSIS, OR TREATMENT. The MusB Phle App is not a medical device and does not diagnose, treat, cure, or prevent any medical condition. Always seek the advice of a qualified healthcare provider with any questions regarding a medical condition.' },
      { type: 'p', text: 'IF YOU ARE EXPERIENCING A MEDICAL EMERGENCY, CALL 911 OR GO TO THE NEAREST EMERGENCY ROOM IMMEDIATELY. Do not use the App to communicate emergency medical information.' },
    ],
  },
  {
    number: 4,
    icon: 'calendar-outline',
    title: 'Phlebotomy and Appointment Services',
    blocks: [
      {
        type: 'bullets',
        items: [
          'Scheduling a phlebotomy appointment through the App does not constitute a guarantee of service availability, which is subject to phlebotomist availability, geographic coverage, and other operational factors.',
          'You agree to provide accurate location, contact, and health information necessary for safe specimen collection.',
          'You must ensure that the collection environment (for home or mobile appointments) is safe and accessible for our phlebotomy professionals.',
          'Cancellation and rescheduling policies are disclosed at the time of booking and are subject to change with notice.',
        ],
      },
    ],
  },
  {
    number: 5,
    icon: 'flask-outline',
    title: 'Diagnostic Testing Services',
    blocks: [
      {
        type: 'bullets',
        items: [
          'Diagnostic tests facilitated through the App are performed by licensed, accredited laboratories. Results must be interpreted by a qualified healthcare provider in the context of your overall health.',
          'No test is 100% accurate. False positive and false negative results can occur. Do not make medical decisions based solely on a test result without consulting a licensed healthcare provider.',
          'Turnaround times are estimates and may vary based on laboratory processing, specimen quality, or other circumstances.',
          'Certain critical results may require us or our affiliated providers to attempt to notify you and/or your healthcare provider. You are responsible for keeping your contact information current.',
        ],
      },
    ],
  },
  {
    number: 6,
    icon: 'clipboard-outline',
    title: 'Clinical Research Pre-Screening',
    blocks: [
      {
        type: 'bullets',
        items: [
          'Pre-screening through the App does not guarantee eligibility for or enrollment in any clinical study. Final eligibility is determined by the study site investigator.',
          'Your rights as a research participant \u2014 including risks, benefits, and the right to withdraw \u2014 are governed by the study-specific informed consent form, not these Terms.',
          'Participation is voluntary. You may withdraw at any time by notifying the study site.',
        ],
      },
    ],
  },
  {
    number: 7,
    icon: 'pulse-outline',
    title: 'Health Tracking and Wellness Features',
    blocks: [
      { type: 'p', text: 'Data you log through wellness features (symptoms, vitals, activity) and any insights generated from it are for general informational and self-monitoring purposes only. These features are not clinical-grade diagnostic tools unless expressly identified as such, and any insights or trends are not a diagnosis.' },
    ],
  },
  {
    number: 8,
    icon: 'lock-open-outline',
    title: 'Device Permissions',
    blocks: [
      { type: 'p', text: 'The App may request the following permissions to function properly:' },
      {
        type: 'bullets',
        items: [
          'Location: to identify nearby service locations, study sites, or to coordinate home visits',
          'Camera: for document scanning, telehealth features, or identity verification',
          'Microphone: for video consultations or voice-enabled features',
          'Health data: to sync data from connected wearables or health apps, where you choose to enable this',
          'Push notifications: for appointment reminders and result availability alerts',
        ],
      },
      { type: 'p', text: 'You may revoke permissions at any time through device settings. Revoking certain permissions may limit App functionality.' },
    ],
  },
  {
    number: 9,
    icon: 'key-outline',
    title: 'Account Registration and Security',
    blocks: [
      {
        type: 'bullets',
        items: [
          'You agree to provide accurate, current, and complete information when creating an account and to keep it updated.',
          'You are responsible for maintaining the confidentiality of your login credentials and all activity occurring under your account.',
          'You agree to notify us promptly at info@musbdiagnostics.com of any unauthorized use of your account.',
          'You agree not to share your account credentials with any other person.',
        ],
      },
    ],
  },
  {
    number: 10,
    icon: 'ban-outline',
    title: 'Acceptable Use',
    blocks: [
      { type: 'p', text: 'You agree not to:' },
      {
        type: 'bullets',
        items: [
          'Provide false or misleading health, identity, or eligibility information',
          'Use the App for any unlawful purpose or in violation of applicable research or clinical regulations',
          'Attempt to access another user\u2019s account or data without authorization',
          'Reverse engineer, decompile, or attempt to extract source code from the App, except as permitted by law',
          'Interfere with or disrupt the App\u2019s integrity or performance, including through introduction of malware',
          'Use the App in any manner that could damage, disable, overburden, or impair our systems',
        ],
      },
    ],
  },
  {
    number: 11,
    icon: 'card-outline',
    title: 'Fees and Payment',
    blocks: [
      { type: 'p', text: 'Applicable fees for diagnostic tests or services will be disclosed before purchase. All payments are processed through a PCI-DSS-compliant third-party payment processor. We do not store full payment card details. Fees related to clinical study participation, if any, are governed by the study-specific consent, not these Terms.' },
    ],
  },
  {
    number: 12,
    icon: 'ribbon-outline',
    title: 'Intellectual Property',
    blocks: [
      { type: 'p', text: 'The App and its content (excluding content you submit) are owned by MusB Research LLC or its licensors and protected by intellectual property laws. We grant you a limited, non-exclusive, non-transferable, revocable license to install and use the App on your personal device for its intended personal, non-commercial purpose. You retain ownership of health data and content you submit, subject to our right to use it to provide App services as described in our Privacy Policy.' },
    ],
  },
  {
    number: 13,
    icon: 'refresh-outline',
    title: 'App Updates and Availability',
    blocks: [
      { type: 'p', text: 'We may update the App from time to time to add features, fix bugs, or address security issues. We recommend keeping the App updated to the current version. We do not guarantee that the App will be available at all times or on all devices. We reserve the right to modify, suspend, or discontinue the App or any feature at any time with reasonable notice.' },
    ],
  },
  {
    number: 14,
    icon: 'link-outline',
    title: 'Third-Party Services',
    blocks: [
      { type: 'p', text: 'The App may integrate with third-party services (laboratories, wearables, payment processors, mapping services). We are not responsible for the practices, content, or performance of those third parties; your use of them may be subject to separate terms and privacy policies.' },
    ],
  },
  {
    number: 15,
    icon: 'alert-circle-outline',
    title: 'Disclaimers',
    highlight: true,
    blocks: [
      { type: 'p', text: 'EXCEPT AS EXPRESSLY STATED, THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY OF DATA. WE DO NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE. THIS SECTION DOES NOT LIMIT ANY WARRANTY OR OBLIGATION THAT CANNOT BE EXCLUDED UNDER APPLICABLE LAW.' },
    ],
  },
  {
    number: 16,
    icon: 'shield-outline',
    title: 'Limitation of Liability',
    highlight: true,
    blocks: [
      { type: 'p', text: 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, MUSB RESEARCH LLC, ITS AFFILIATES, AND ITS AND THEIR OFFICERS, EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, PROFITS, OR REVENUE, ARISING FROM YOUR USE OF THE APP. OUR TOTAL CUMULATIVE LIABILITY FOR ANY CLAIM ARISING FROM THE APP WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100). THIS LIMITATION DOES NOT APPLY TO CLAIMS ARISING FROM GROSS NEGLIGENCE, WILLFUL MISCONDUCT, OR PERSONAL INJURY CAUSED BY PROFESSIONAL MEDICAL NEGLIGENCE, TO THE EXTENT PROHIBITED BY LAW.' },
    ],
  },
  {
    number: 17,
    icon: 'hand-left-outline',
    title: 'Indemnification',
    blocks: [
      { type: 'p', text: 'You agree to indemnify and hold harmless MusB Research LLC and its affiliates from any claims, damages, liabilities, and expenses (including reasonable attorneys\u2019 fees) arising from your breach of these Terms, your violation of applicable law, or your submission of false or misleading information, except to the extent caused by our own negligence or willful misconduct.' },
    ],
  },
  {
    number: 18,
    icon: 'briefcase-outline',
    title: 'Dispute Resolution and Arbitration',
    blocks: [
      { type: 'p', text: 'Except where prohibited by law, any dispute arising out of or relating to these Terms or the App will be resolved through binding arbitration administered by the American Arbitration Association under its applicable rules, on an individual basis. You and MusB Research LLC each waive the right to a jury trial and to participate in a class action. You may opt out within 30 days of first accepting these Terms by sending written notice to info@musbdiagnostics.com. Nothing in this section limits your right to file a complaint with HHS OCR, the FDA, or other government agency.' },
    ],
  },
  {
    number: 19,
    icon: 'business-outline',
    title: 'Governing Law',
    blocks: [
      { type: 'p', text: 'These Terms are governed by the laws of the State of Florida, without regard to its conflict-of-laws principles, except to the extent preempted by federal law. Any legal action not subject to arbitration shall be brought exclusively in the state or federal courts located in Pasco County, Florida.' },
    ],
  },
  {
    number: 20,
    icon: 'exit-outline',
    title: 'Termination',
    blocks: [
      { type: 'p', text: 'You may stop using the App and delete your account at any time. We may suspend or terminate your access if you violate these Terms, engage in fraudulent or unsafe conduct, or as required by a study protocol or IRB determination. Termination does not affect data retention obligations described in our Privacy Policy or applicable law.' },
    ],
  },
  {
    number: 21,
    icon: 'create-outline',
    title: 'Changes to These Terms',
    blocks: [
      { type: 'p', text: 'We may modify these Terms from time to time. Material changes will be communicated via in-app notification or email and reflected in an updated "Last Updated" date. Continued use of the App after changes take effect constitutes acceptance of the revised Terms.' },
    ],
  },
  {
    number: 22,
    icon: 'layers-outline',
    title: 'Miscellaneous',
    blocks: [
      {
        type: 'bullets',
        items: [
          'Entire Agreement: These Terms, together with our Privacy Policy and any study-specific informed consent, constitute the entire agreement between you and us regarding the App.',
          'Severability: If any provision is found unenforceable, the remaining provisions remain in full force.',
          'No Waiver: Our failure to enforce any provision is not a waiver of our right to do so later.',
          'Assignment: You may not assign these Terms without our consent; we may assign in connection with a merger, acquisition, or sale of assets.',
        ],
      },
    ],
  },
  {
    number: 23,
    icon: 'call-outline',
    title: 'Contact Us',
    blocks: [
      { type: 'p', text: 'MusB Research LLC (d/b/a MusB Diagnostics / MusB Labs / MusB Labs)\n6331 State Road 54, New Port Richey, FL 34653, USA\nEmail: info@musbdiagnostics.com\nPhone: +1 (813) 419-0781\nWebsite: www.musblabs.com' },
    ],
  },
];

const privacyIntro = {
  meta: 'MusB Phle Mobile App\nMusB Diagnostics / MusB Labs — a division of MusB Research LLC\nEffective: July 2026  |  Last Updated: July 2026',
  body:
    'This Privacy Policy ("Policy") applies to the MusB Phle mobile application ("App") operated by MusB Research LLC doing business as MusB Diagnostics / MusB Labs and MusB Labs ("we," "us," or "our"). It describes how we collect, use, disclose, and protect personal information \u2014 including protected health information ("PHI") where applicable \u2014 that you provide or we obtain through your use of the App.\n\nBy downloading or using the App, you agree to this Policy. If you do not agree, please uninstall the App. Questions? Contact us at info@musbdiagnostics.com.',
};

const privacySections = [
  {
    number: 1,
    icon: 'people-outline',
    title: 'Who We Are',
    blocks: [
      { type: 'p', text: 'MusB Research LLC is a Florida limited liability company operating the MusB Diagnostics / MusB Labs, MusB Labs, and MusB Phle brands. We facilitate clinical diagnostic testing, phlebotomy services, clinical research recruitment, and health and wellness services.' },
      { type: 'p', text: 'MusB Research LLC (d/b/a MusB Diagnostics / MusB Labs / MusB Labs)\n6331 State Road 54, New Port Richey, FL 34653, USA\nWebsite: www.musblabs.com | Email: info@musbdiagnostics.com | Phone: +1 (813) 419-0781' },
    ],
  },
  {
    number: 2,
    icon: 'document-text-outline',
    title: 'Information We Collect Through the App',
    blocks: [
      { type: 'sub', text: '2.1 Information You Provide' },
      { type: 'p', text: 'We collect information you voluntarily provide when you create an account or complete your profile, schedule a phlebotomy or diagnostic test appointment, complete health history, screening, or intake forms, communicate with us through in-app messaging or support, or apply to participate in a clinical study or wellness program. This may include:' },
      {
        type: 'bullets',
        items: [
          'Identity and contact information: name, date of birth, sex/gender, mailing address, email, and phone number',
          'Health and clinical information: medical history, symptoms, current medications, past diagnostic or lab results, and questionnaire responses',
          'Appointment and scheduling preferences',
          'Insurance and payment information (processed by a PCI-DSS-compliant third-party processor)',
          'Account credentials and authentication data',
        ],
      },
      { type: 'sub', text: '2.2 Information Collected Automatically' },
      { type: 'p', text: 'When you use the App, we automatically collect:' },
      {
        type: 'bullets',
        items: [
          'Device identifiers (e.g., device ID, advertising ID) and model information',
          'Operating system version and app version',
          'In-app usage data: screens viewed, features used, timestamps, and session duration',
          'Crash reports and diagnostic data',
          'Push notification tokens (to send appointment reminders and notifications)',
        ],
      },
      { type: 'sub', text: '2.3 Location Information' },
      { type: 'p', text: 'With your permission, the App may collect approximate location (to show nearby service locations or study sites) and precise location (if you enable this feature for navigation or home-visit coordination). You can revoke location permissions at any time through your device settings. Revoking location access may limit certain App features.' },
      { type: 'sub', text: '2.4 Health Device and Wearable Data' },
      { type: 'p', text: 'If you choose to connect a wearable device or health platform (e.g., Apple Health, Google Fit) to the App, we may collect health and fitness data such as heart rate, steps, sleep patterns, and other physiological measurements, as well as data imported from connected health apps on your device. This data is used solely to support the study or wellness program you have joined and is shared only as described in Section 4. You control this connection through your device or health-app settings and may disconnect at any time.' },
      { type: 'sub', text: '2.5 Camera and Microphone' },
      { type: 'p', text: 'The App may request access to your camera (e.g., for document scanning, telehealth features, or ID verification) and microphone (e.g., for video consultations). We access these features only when you actively use the relevant function. You can revoke these permissions in device settings.' },
    ],
  },
  {
    number: 3,
    icon: 'settings-outline',
    title: 'How We Use Your Information',
    blocks: [
      { type: 'p', text: 'We use the information we collect to:' },
      {
        type: 'bullets',
        items: [
          'Schedule and coordinate phlebotomy appointments and diagnostic services',
          'Process and deliver diagnostic test orders and results',
          'Evaluate your eligibility for and facilitate enrollment in clinical studies and wellness programs',
          'Send appointment reminders, result notifications, and service communications',
          'Provide in-app messaging and customer support',
          'Operate, maintain, secure, and improve the App',
          'Meet legal, regulatory, and reporting obligations (including HIPAA, FDA, IRB, and state requirements)',
          'Conduct internal analytics, quality improvement, and de-identified research',
          'Detect, investigate, and prevent fraud, misuse, and security incidents',
        ],
      },
    ],
  },
  {
    number: 4,
    icon: 'share-social-outline',
    title: 'Sharing Your Information',
    blocks: [
      { type: 'p', text: 'MusB Research LLC does not sell your personal information or PHI. We share information only as follows:' },
      {
        type: 'bullets',
        items: [
          'MusB Brands: MusB Diagnostics / MusB Labs, MusB Labs, MusB Phle, and other MusB Research LLC brand names are not separate legal entities. Sharing across these brands is an internal use by MusB Research LLC.',
          'Phlebotomy and laboratory partners: Licensed phlebotomists, collection sites, and accredited laboratories that perform and process your tests, under written agreements and applicable law',
          'Service providers: Cloud hosting (AWS), payment processors, analytics providers, IT vendors, and professional advisors who process data under written contracts',
          'External research collaborators: Where a study involves an external sponsor, institution, or CRO, disclosed in your study-specific informed consent and governed by a data use or HIPAA business associate agreement',
          'IRBs, FDA, and other regulators: As required to conduct, monitor, and report on clinical studies or to comply with applicable law',
          'Legal process and safety: To comply with a court order, subpoena, or government request, or to protect safety, rights, or property',
          'Business transfers: In connection with a merger, acquisition, or sale of assets',
          'With your consent: To any party you specifically authorize',
        ],
      },
      { type: 'p', text: 'De-identified or aggregated data may be used or disclosed for any lawful purpose without restriction.' },
    ],
  },
  {
    number: 5,
    icon: 'shield-checkmark-outline',
    title: 'Protected Health Information (HIPAA)',
    highlight: true,
    blocks: [
      { type: 'p', text: 'Where information you provide constitutes PHI in connection with a HIPAA-covered activity, it is handled in accordance with the HIPAA Privacy Rule, Security Rule, and HITECH Act. A separate HIPAA Notice of Privacy Practices ("NPP") is provided to you at enrollment and controls our use of PHI. In a conflict between this Policy and the NPP with respect to PHI, the NPP controls.' },
    ],
  },
  {
    number: 6,
    icon: 'lock-closed-outline',
    title: 'Data Security',
    blocks: [
      { type: 'p', text: 'We implement the following safeguards to protect your information:' },
      {
        type: 'bullets',
        items: [
          'End-to-end encryption of data in transit (TLS/HTTPS) and at rest (AES-256)',
          'Multi-factor authentication options for your account',
          'Role-based access controls limiting data access to authorized personnel',
          'Audit logging, anomaly detection, and regular security assessments',
          'Remote wipe capability for App data on lost or stolen devices (where technically feasible)',
        ],
      },
      { type: 'p', text: 'No system is completely secure. If we become aware of a breach affecting your information, we will notify you and applicable regulators consistent with the HIPAA Breach Notification Rule, the FTC Health Breach Notification Rule, and applicable state data breach laws.' },
    ],
  },
  {
    number: 7,
    icon: 'time-outline',
    title: 'Data Retention',
    blocks: [
      { type: 'p', text: 'We retain personal information and PHI for as long as necessary to fulfill the purposes described in this Policy, including mandatory retention periods under FDA clinical trial regulations, applicable study protocols, and state medical record laws. When no longer needed, we delete, de-identify, or securely isolate data pending deletion.' },
    ],
  },
  {
    number: 8,
    icon: 'happy-outline',
    title: 'Children\u2019s Privacy',
    blocks: [
      { type: 'p', text: 'The MusB Phle App is not directed to children under 18. We do not knowingly collect personal information from children under 13 in violation of COPPA. Enrollment of pediatric research participants occurs only under documented parental/guardian consent in compliance with applicable regulations (45 C.F.R. Part 46, Subpart D).' },
    ],
  },
  {
    number: 9,
    icon: 'finger-print-outline',
    title: 'Your Privacy Rights',
    blocks: [
      { type: 'p', text: 'Depending on your jurisdiction, you may have the right to:' },
      {
        type: 'bullets',
        items: [
          'Access and obtain a copy of your personal information or PHI',
          'Request correction of inaccurate or incomplete information',
          'Request deletion of your information (subject to legal retention requirements)',
          'Withdraw consent or HIPAA authorization (subject to the limitations described in your consent)',
          'Opt out of non-essential marketing communications (via app settings or by contacting us)',
          'Lodge a complaint with a government agency (e.g., HHS Office for Civil Rights, FTC, or your state attorney general)',
        ],
      },
      { type: 'p', text: 'To exercise these rights, contact us at info@musbdiagnostics.com or through the App\u2019s Settings > Privacy menu. We may require identity verification. California residents, see Section 10.' },
    ],
  },
  {
    number: 10,
    icon: 'flag-outline',
    title: 'California and Other State Privacy Rights',
    blocks: [
      { type: 'p', text: 'California residents have rights under the CCPA, including the right to know, the right to deletion, and the right to non-discrimination. Health information collected under a HIPAA-covered activity may be exempt from certain CCPA provisions but remains protected.' },
      { type: 'p', text: 'Residents of Washington, Nevada, Connecticut, and other states with consumer health data laws may have additional rights. Contact us at info@musbdiagnostics.com to submit a request.' },
    ],
  },
  {
    number: 11,
    icon: 'notifications-outline',
    title: 'Push Notifications',
    blocks: [
      { type: 'p', text: 'The App may send you push notifications for appointment reminders, test result availability, and other service communications. You can manage notification preferences in the App\u2019s Settings menu or through your device notification settings.' },
    ],
  },
  {
    number: 12,
    icon: 'code-slash-outline',
    title: 'Third-Party SDKs and Services',
    blocks: [
      { type: 'p', text: 'The App may use third-party software development kits (SDKs) for analytics, crash reporting, and payment processing. These third parties may collect data subject to their own privacy policies. We require all third-party providers to maintain appropriate data protection standards.' },
    ],
  },
  {
    number: 13,
    icon: 'create-outline',
    title: 'Changes to This Policy',
    blocks: [
      { type: 'p', text: 'We may update this Policy from time to time. Material changes will be indicated by an in-app notification and an updated "Last Updated" date. Continued use of the App after changes take effect constitutes acceptance of the updated Policy.' },
    ],
  },
  {
    number: 14,
    icon: 'mail-outline',
    title: 'Contact Us',
    blocks: [
      { type: 'p', text: 'If you have questions about this Policy, please contact us:' },
      { type: 'p', text: 'MusB Research LLC (d/b/a MusB Diagnostics / MusB Labs / MusB Labs)\n6331 State Road 54, New Port Richey, FL 34653, USA\nEmail: info@musbdiagnostics.com\nPhone: +1 (813) 419-0781\nWebsite: www.musblabs.com' },
      { type: 'p', text: 'For HIPAA-related inquiries, please direct your request to our Privacy Officer at the address above.' },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Animated building blocks                                           */
/* ------------------------------------------------------------------ */

function FadeInUp({ children, delay = 0, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 420,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

function AnimatedPressable({ onPress, disabled, style, children }) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        disabled={disabled}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={style}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

/* Renders the block list (paragraphs / sub-headers / bullet lists) for a subsection */
function Blocks({ blocks, accent }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === 'sub') {
          return (
            <Text key={i} style={styles.subSubTitle}>
              {b.text}
            </Text>
          );
        }
        if (b.type === 'bullets') {
          return (
            <View key={i} style={styles.bulletGroup}>
              {b.items.map((item, j) => (
                <View key={j} style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: accent }]} />
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={i} style={styles.body}>
            {b.text}
          </Text>
        );
      })}
    </>
  );
}

/* A single numbered, colour-accented subsection card */
function SubsectionCard({ item, index }) {
  const accent = ACCENTS[index % ACCENTS.length];
  return (
    <FadeInUp delay={Math.min(index * 35, 500)}>
      <View
        style={[
          styles.card,
          { borderLeftColor: accent },
          item.highlight && styles.cardHighlight,
        ]}
      >
        <View style={styles.cardHeaderRow}>
          <LinearGradient
            colors={[accent, shade(accent)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badge}
          >
            <Text style={styles.badgeText}>{item.number}</Text>
          </LinearGradient>
          <Ionicons name={item.icon} size={18} color={accent} style={{ marginLeft: 10 }} />
          <Text style={styles.cardTitle}>{item.title}</Text>
        </View>
        <Blocks blocks={item.blocks} accent={accent} />
      </View>
    </FadeInUp>
  );
}

/* Small helper: darken a hex color slightly for gradient depth */
function shade(hex, amt = -24) {
  const num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0x00ff) + amt;
  let b = (num & 0x0000ff) + amt;
  r = Math.max(Math.min(255, r), 0);
  g = Math.max(Math.min(255, g), 0);
  b = Math.max(Math.min(255, b), 0);
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

/* Big section header (Terms / Privacy) with icon + gradient underline */
function BigSectionHeader({ icon, title, meta }) {
  return (
    <FadeInUp>
      <View style={styles.bigHeaderWrap}>
        <LinearGradient
          colors={[NAVY, BRAND]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.bigHeaderIconWrap}
        >
          <Ionicons name={icon} size={26} color="#FFFFFF" />
        </LinearGradient>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.bigHeaderTitle}>{title}</Text>
          <LinearGradient
            colors={[BRAND, 'rgba(0,160,228,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bigHeaderUnderline}
          />
        </View>
      </View>
      <Text style={styles.metaText}>{meta}</Text>
    </FadeInUp>
  );
}

/* Decorative divider that separates Terms from Privacy Policy */
function SectionDivider({ label, icon }) {
  return (
    <FadeInUp style={styles.dividerWrap}>
      <View style={styles.dividerLineRow}>
        <LinearGradient
          colors={['rgba(10,31,92,0)', NAVY]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.dividerLine}
        />
        <View style={styles.dividerBadge}>
          <Ionicons name={icon} size={20} color="#FFFFFF" />
        </View>
        <LinearGradient
          colors={[NAVY, 'rgba(10,31,92,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.dividerLine}
        />
      </View>
      <Text style={styles.dividerLabel}>{label}</Text>
    </FadeInUp>
  );
}

/* ------------------------------------------------------------------ */
/*  Screen                                                             */
/* ------------------------------------------------------------------ */

export default function TermsScreen({ navigation }) {
  const [readAgreed, setReadAgreed] = useState(false);
  const checkScale = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  const handleBack = () => {
    navigation.navigate('Splash', { agreedTerms: readAgreed });
  };

  const toggleCheck = () => {
    Animated.sequence([
      Animated.spring(checkScale, { toValue: 0.75, useNativeDriver: true, speed: 40, bounciness: 0 }),
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }),
    ]).start();
    setReadAgreed((prev) => !prev);
  };

  const progressScale = scrollY.interpolate({
    inputRange: [0, 6000],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <LinearGradient colors={[NAVY, BRAND]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Splash')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Privacy Policy</Text>
        <View style={{ width: 60 }} />
      </LinearGradient>

      {/* Scroll progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFillWrap,
            { transform: [{ scaleX: progressScale }] },
          ]}
        >
          <LinearGradient
            colors={[BRAND, '#6C5CE7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.progressFill}
          />
        </Animated.View>
      </View>

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
      >
        {/* ===================== TERMS AND CONDITIONS ===================== */}
        <BigSectionHeader icon="document-text-outline" title="Terms and Conditions" meta={termsIntro.meta} />
        <FadeInUp delay={60}>
          <Text style={styles.introBody}>{termsIntro.body}</Text>
        </FadeInUp>

        {termsSections.map((item, i) => (
          <SubsectionCard key={`t-${item.number}`} item={item} index={i} />
        ))}
        {/* =================== END TERMS AND CONDITIONS =================== */}

        {/* ---- generous breathing room + visual divider before Privacy ---- */}
        <SectionDivider label="Privacy Policy Begins" icon="shield-checkmark" />

        {/* ===================== PRIVACY POLICY ===================== */}
        <BigSectionHeader icon="shield-checkmark-outline" title="Privacy Policy" meta={privacyIntro.meta} />
        <FadeInUp delay={60}>
          <Text style={styles.introBody}>{privacyIntro.body}</Text>
        </FadeInUp>

        {privacySections.map((item, i) => (
          <SubsectionCard key={`p-${item.number}`} item={item} index={i} />
        ))}
        {/* =================== END PRIVACY POLICY =================== */}

        <View style={{ height: 28 }} />

        <FadeInUp>
          <View style={[styles.card, { borderLeftColor: BRAND }]}>
            <View style={styles.cardHeaderRow}>
              <LinearGradient colors={[BRAND, shade(BRAND)]} style={styles.badge}>
                <Ionicons name="ribbon-outline" size={16} color="#FFFFFF" />
              </LinearGradient>
              <Text style={[styles.cardTitle, { marginLeft: 10 }]}>Accreditation</Text>
            </View>
            <Text style={styles.body}>
              MusB Diagnostics operates under CLIA-COLA accreditation standards to ensure the quality and reliability
              of laboratory testing services provided through this platform.
            </Text>
          </View>
        </FadeInUp>
      </Animated.ScrollView>

      <View style={styles.footer}>
        <View style={styles.checkRow}>
          <AnimatedPressable onPress={toggleCheck}>
            <Animated.View
              style={[
                styles.checkbox,
                readAgreed && styles.checkboxChecked,
                { transform: [{ scale: checkScale }] },
              ]}
            >
              {readAgreed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </Animated.View>
          </AnimatedPressable>
          <Text style={styles.checkText}>I have read and understood the Terms & Privacy Policy</Text>
        </View>

        <AnimatedPressable onPress={handleBack} disabled={!readAgreed} style={{ borderRadius: 14 }}>
          <LinearGradient
            colors={readAgreed ? [NAVY, BRAND] : ['#C7CEE3', '#C7CEE3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.confirmBtn}
          >
            <Text style={styles.confirmBtnText}>
              {readAgreed ? 'Accept & Continue' : 'Please check the box above'}
            </Text>
            {readAgreed && <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />}
          </LinearGradient>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 70 },
  backText: { fontSize: 14, color: '#FFFFFF', fontWeight: '600', marginLeft: 2 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  progressTrack: { height: 3, backgroundColor: '#E4E9F5', overflow: 'hidden'  },
  progressFillWrap: {
    flex: 1,width: '200%', marginLeft: '-100%',},
  progressFill: { height: 3, width: '100%' },

  scroll: { flex: 1 },
  scrollContent: { padding: 18, paddingBottom: 40 },

  bigHeaderWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  bigHeaderIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: NAVY,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  bigHeaderTitle: { fontSize: 20, fontWeight: '800', color: NAVY },
  bigHeaderUnderline: { height: 4, borderRadius: 2, marginTop: 6, width: '70%' },

  metaText: {
    fontSize: 12,
    color: '#6B7590',
    fontStyle: 'italic',
    marginTop: 10,
    marginBottom: 10,
    lineHeight: 18,
  },
  introBody: {
    fontSize: 13.5,
    lineHeight: 21,
    color: '#3A4258',
    marginBottom: 18,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#1B2A57',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHighlight: {
    backgroundColor: '#FFF7ED',
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  cardTitle: { fontSize: 14.5, fontWeight: '700', color: NAVY, marginLeft: 8, flexShrink: 1 },

  subSubTitle: { fontSize: 13, fontWeight: '700', color: '#1B2A57', marginTop: 10, marginBottom: 4 },
  body: { fontSize: 13.5, lineHeight: 21, color: '#3A4258', marginBottom: 4 },

  bulletGroup: { marginTop: 4, marginBottom: 4 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  bulletDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6, marginRight: 10 },
  bulletText: { flex: 1, fontSize: 13.5, lineHeight: 20, color: '#3A4258' },

  dividerWrap: { alignItems: 'center', marginVertical: 36 },
  dividerLineRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  dividerLine: { flex: 1, height: 2, borderRadius: 1 },
  dividerBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
    shadowColor: NAVY,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dividerLabel: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: NAVY,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#EEF1F8', backgroundColor: '#FFFFFF' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: NAVY,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: NAVY, borderColor: NAVY },
  checkText: { fontSize: 13, color: '#333', flexShrink: 1 },

  confirmBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  confirmBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
