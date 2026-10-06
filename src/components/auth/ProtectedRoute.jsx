// src/components/auth/ProtectedRoute.jsx
// The door in front of every signed in page. No session goes to /login/. A
// session that arrived through a password reset link and has not set a new
// password goes to /reset-password/ and nowhere else, see the recovering note
// in src/hooks/useAuth.jsx. Without that second check a reset link was a
// plain sign in, Tyler 2026-10-05.

import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { Center, Spinner } from '@chakra-ui/react';
import { useAuth } from '../../hooks/useAuth';

const ProtectedRoute = () => {
  const { user, loading, recovering } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Center h="100vh" bg="surface.950">
        <Spinner size="xl" color="brand.500" thickness="3px" />
      </Center>
    );
  }

  if (!user) {
    return <Navigate to="/login/" state={{ from: location }} replace />;
  }

  if (recovering) {
    return <Navigate to="/reset-password/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
