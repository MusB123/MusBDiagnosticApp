import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StripeProvider } from '@stripe/stripe-react-native';

// Shared
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import RoleSelectScreen from './screens/RoleSelectScreen';

// Patient Screens
import CreateAccountScreen from './screens/CreateAccountScreen';
import VerifyOtpScreen from './screens/VerifyOtpScreen';
import HealthProfileScreen from './screens/HealthProfileScreen';
import HomeScreen from './screens/HomeScreen';
import BookMobileVisitScreen from './screens/BookMobileVisitScreen';
import SelectTestsScreen from './screens/SelectTestsScreen';
import InPersonTestsScreen from './screens/InPersonTestsScreen';
import CheckoutScreen from './screens/CheckoutScreen';
import LiveTrackingScreen from './screens/LiveTrackingScreen';
import ScheduleScreen from './screens/ScheduleScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import HistoryScreen from './screens/HistoryScreen';
import ProfileScreen from './screens/ProfileScreen';

// Phlebotomist
import RegisterScreen        from './screens/RegisterScreen';
import RegisterScreen2       from './screens/RegisterScreen2';
import RegisterScreen3       from './screens/RegisterScreen3';
import AwaitingApproval      from './screens/AwaitingApproval';
import DashboardScreen       from './screens/DashboardScreen';
import JobHistoryScreen      from './screens/JobHistoryScreen';
import MapScreen             from './screens/MapScreen';
import NewRequestScreen      from './screens/NewRequestScreen';
import JobAcceptedScreen     from './screens/JobAcceptedScreen';
import PhlebProfileScreen    from './screens/PhlebProfileScreen';


const Stack = createNativeStackNavigator();

const STRIPE_PUBLISHABLE_KEY =
  'pk_test_51QvKvk086LMKPBIwE5lv6pzeGoiRQhuqL7mnI6V0RqL7YV4Hv8BGg38rU5R0W9mIaZDPvKC5SlwJyZy7bPXg6pHJ00glmQ7Ycs';

export default function App() {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{ headerShown: false }}
        >
          {/* Shared */}
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />

          {/* Patient */}
          <Stack.Screen name="PatientCreateAccount" component={CreateAccountScreen} />
          <Stack.Screen name="PatientVerifyOtp" component={VerifyOtpScreen} />
          <Stack.Screen name="HealthProfile" component={HealthProfileScreen} />
          <Stack.Screen name="PatientHome" component={HomeScreen} />
          <Stack.Screen name="BookMobileVisit" component={BookMobileVisitScreen} />
          <Stack.Screen name="SelectTests" component={SelectTestsScreen} />
          <Stack.Screen name="InPersonTests" component={InPersonTestsScreen} />
          <Stack.Screen name="Checkout" component={CheckoutScreen} />
          <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} />
          <Stack.Screen name="Schedule" component={ScheduleScreen} />
          <Stack.Screen name="PatientNotifications" component={NotificationsScreen} />
          <Stack.Screen name="PatientHistory" component={HistoryScreen} />
          <Stack.Screen name="PatientProfile" component={ProfileScreen} />

          {/* Phlebotomist */}
          <Stack.Screen  name="PhlebDashboard"     component={DashboardScreen}/>
          <Stack.Screen  name="Register"           component={RegisterScreen} />
          <Stack.Screen  name="RegisterScreen2"    component={RegisterScreen2} />
          <Stack.Screen  name="RegisterScreen3"    component={RegisterScreen3} />
          <Stack.Screen  name="AwaitingApproval"   component={AwaitingApproval} />
          <Stack.Screen  name="PatientMap"         component={MapScreen} />
          <Stack.Screen  name="NewRequest"         component={NewRequestScreen} />
          <Stack.Screen  name="JobAccepted"        component={JobAcceptedScreen} />
          <Stack.Screen  name="PhlebHistory"       component={JobHistoryScreen}/>
          <Stack.Screen  name="PhlebProfile"       component={PhlebProfileScreen}/>
        </Stack.Navigator>
      </NavigationContainer>
    </StripeProvider>
  );
}