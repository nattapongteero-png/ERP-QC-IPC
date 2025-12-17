'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Leaf, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        router.push('/dashboard');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-green-400/20 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>
        
        {/* Floating Leaves Pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <pattern id="leaves" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M10 2 Q15 10 10 18 Q5 10 10 2" fill="currentColor" className="text-white"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#leaves)"/>
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
              <Leaf className="h-10 w-10" />
            </div>
            <Sparkles className="h-6 w-6 text-emerald-300 animate-pulse" />
          </div>
          
          <h1 className="text-5xl font-bold mb-6 leading-tight">
            Herbal Medicine
            <span className="block text-emerald-300">ERP System</span>
          </h1>
          
          <p className="text-xl text-emerald-100 mb-8 leading-relaxed max-w-md">
            ระบบบริหารจัดการการผลิตยาสมุนไพรครบวงจร ตั้งแต่วัตถุดิบจนถึงสินค้าสำเร็จรูป
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-emerald-200">
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
              <span>ควบคุมคุณภาพตามมาตรฐาน GMP</span>
            </div>
            <div className="flex items-center gap-3 text-emerald-200">
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
              <span>ติดตามล็อตการผลิตแบบ Real-time</span>
            </div>
            <div className="flex items-center gap-3 text-emerald-200">
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
              <span>รายงานและวิเคราะห์ข้อมูลอัตโนมัติ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-lg shadow-emerald-500/30">
              <Leaf className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Herbal Medicine ERP</h1>
            <p className="text-gray-500 mt-1">ระบบบริหารจัดการการผลิตยาสมุนไพร</p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-8 border border-gray-100">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">ยินดีต้อนรับ</h2>
              <p className="text-gray-500 mt-2">เข้าสู่ระบบเพื่อดำเนินการต่อ</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">อีเมล</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">รหัสผ่าน</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    เข้าสู่ระบบ
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>

            {/* Demo Credentials */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-500 text-center mb-4">
                บัญชีทดสอบ
              </p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => { setEmail('admin@herbal-erp.com'); setPassword('admin123'); }}
                  className="px-4 py-2.5 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 rounded-lg text-sm text-gray-600 hover:text-emerald-700 transition-all duration-200 flex items-center justify-between"
                >
                  <span className="font-medium">Admin</span>
                  <span className="text-gray-400">admin@herbal-erp.com</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setEmail('production@herbal-erp.com'); setPassword('user123'); }}
                  className="px-4 py-2.5 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 rounded-lg text-sm text-gray-600 hover:text-emerald-700 transition-all duration-200 flex items-center justify-between"
                >
                  <span className="font-medium">Production</span>
                  <span className="text-gray-400">production@herbal-erp.com</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setEmail('qc@herbal-erp.com'); setPassword('user123'); }}
                  className="px-4 py-2.5 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 rounded-lg text-sm text-gray-600 hover:text-emerald-700 transition-all duration-200 flex items-center justify-between"
                >
                  <span className="font-medium">QC</span>
                  <span className="text-gray-400">qc@herbal-erp.com</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-gray-400 mt-8">
            © 2025 Herbal Medicine ERP. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
