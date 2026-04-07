import { Routes, Route, Navigate } from "react-router-dom"
import { Suspense, lazy } from "react"
import Loader from "@food/components/Loader"
import AuthRedirect from "@food/components/AuthRedirect"

const Login = lazy(() => import("./pages/Login"))

export default function AuthRoutes() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route 
          path="login" 
          element={
            <AuthRedirect module="user">
              <Login />
            </AuthRedirect>
          } 
        />
        <Route path="*" element={<Navigate to="/auth/login" replace />} />
      </Routes>
    </Suspense>
  )
}
