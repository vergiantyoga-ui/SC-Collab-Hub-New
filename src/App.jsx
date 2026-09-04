import { Navigate, Route, Routes } from 'react-router-dom';

import SupplierLogin from './pages/auth/SupplierLogin.jsx';
import StaffLogin from './pages/auth/StaffLogin.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';

import RegisterWizard from './pages/supplier/RegisterWizard.jsx';
import SupplierLayout from './components/layout/SupplierLayout.jsx';
import ChangePassword from './pages/supplier/ChangePassword.jsx';
import ProfileOnboarding from './pages/supplier/ProfileOnboarding.jsx';
import ConsentPage from './pages/supplier/ConsentPage.jsx';
import SupplierStatus from './pages/supplier/SupplierStatus.jsx';
import ActiveProfile from './pages/supplier/ActiveProfile.jsx';

import InternalLayout from './components/layout/InternalLayout.jsx';
import InternalHome from './pages/internal/InternalHome.jsx';
import QueueDashboard from './pages/internal/QueueDashboard.jsx';
import InternalRegistration from './pages/internal/InternalRegistration.jsx';
import ManagerApprovals from './pages/internal/ManagerApprovals.jsx';
import DocumentVerification from './pages/internal/DocumentVerification.jsx';

import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/masuk" replace />} />

      {/* Publik */}
      <Route path="/masuk" element={<SupplierLogin />} />
      <Route path="/daftar" element={<RegisterWizard />} />
      <Route path="/lupa-sandi" element={<ForgotPassword />} />
      <Route path="/internal/masuk" element={<StaffLogin />} />

      {/* Portal pemasok */}
      <Route path="/portal" element={<SupplierLayout />}>
        <Route index element={<Navigate to="/portal/status" replace />} />
        <Route path="ganti-sandi" element={<ChangePassword />} />
        <Route path="status" element={<SupplierStatus />} />
        <Route path="profil-onboarding" element={<ProfileOnboarding />} />
        <Route path="persetujuan" element={<ConsentPage />} />
        <Route path="profil" element={<ActiveProfile />} />
      </Route>

      {/* Konsol internal */}
      <Route path="/internal" element={<InternalLayout />}>
        <Route index element={<Navigate to="/internal/beranda" replace />} />
        <Route path="beranda" element={<InternalHome />} />
        <Route path="antrian" element={<QueueDashboard />} />
        <Route path="registrasi/:id" element={<InternalRegistration />} />
        <Route path="approval" element={<ManagerApprovals />} />
        <Route path="verifikasi" element={<DocumentVerification />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
