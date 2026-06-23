'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Leaf, Mail, Lock, ArrowRight, Sparkles, Shield, Clock, BarChart3 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('login');
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
        setError(data.error || t('errors.loginFailed'));
      }
    } catch (err) {
      setError(t('errors.genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Shield, textKey: 'features.gmpCompliance' as const },
    { icon: Clock, textKey: 'features.realTimeTracking' as const },
    { icon: BarChart3, textKey: 'features.autoReports' as const },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Left Side - Decorative (Hidden on mobile, shown on tablet and desktop) */}
      <div className="hidden md:flex md:w-2/5 lg:w-1/2 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 lg:top-20 lg:left-20 w-48 lg:w-72 h-48 lg:h-72 bg-emerald-500/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-10 right-10 lg:bottom-20 lg:right-20 w-64 lg:w-96 h-64 lg:h-96 bg-teal-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/3 w-40 lg:w-64 h-40 lg:h-64 bg-green-400/20 rounded-full blur-3xl animate-pulse delay-500"></div>
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
        <div className="relative z-10 flex flex-col justify-center px-8 lg:px-16 py-12 text-white">
          <div className="flex items-center gap-3 mb-6 lg:mb-8">
            <div className="p-2.5 lg:p-3 bg-white/20 backdrop-blur-sm rounded-xl lg:rounded-2xl">
              <Leaf className="h-7 w-7 lg:h-10 lg:w-10" />
            </div>
            <Sparkles className="h-5 w-5 lg:h-6 lg:w-6 text-emerald-300 animate-pulse" />
          </div>

          <h1 className="text-3xl lg:text-5xl font-bold mb-4 lg:mb-6 leading-tight">
            {t('title')}
            <span className="block text-emerald-300">{t('subtitle')}</span>
          </h1>

          <p className="text-base lg:text-xl text-emerald-100 mb-6 lg:mb-8 leading-relaxed max-w-md">
            {t('tagline')}
          </p>

          <div className="space-y-3 lg:space-y-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3 text-emerald-200">
                <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                  <feature.icon className="h-4 w-4" />
                </div>
                <span className="text-sm lg:text-base">{t(feature.textKey)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile/Tablet Logo - Shown on mobile, hidden on tablet+ where left panel shows */}
          <div className="md:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-lg shadow-emerald-500/30">
              <Leaf className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{t('appName')}</h1>
            <p className="text-gray-500 mt-1 text-sm">{t('taglineShort')}</p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl shadow-gray-200/50 p-6 sm:p-8 border border-gray-100">
            <div className="text-center mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">{t('form.welcome')}</h2>
              <p className="text-gray-500 mt-1 md:mt-2 text-sm md:text-base">{t('form.welcomeSubtitle')}</p>
            </div>

            <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4 md:space-y-5">
              {/* Email Field */}
              <div className="space-y-1.5 md:space-y-2">
                <label className="text-sm font-medium text-gray-700">{t('form.email')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 md:pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    name="herbal-login-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('form.emailPlaceholder')}
                    required
                    autoComplete="off"
                    data-lpignore="true"
                    data-form-type="other"
                    className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 text-sm md:text-base"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5 md:space-y-2">
                <label className="text-sm font-medium text-gray-700">{t('form.password')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 md:pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    name="herbal-login-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('form.passwordPlaceholder')}
                    required
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-form-type="other"
                    className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 text-sm md:text-base"
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 md:p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 md:py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm md:text-base"
              >
                {isLoading ? (
                  <div className="w-5 h-5 md:w-6 md:h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    {t('form.submit')}
                    <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
                  </>
                )}
              </button>
            </form>

            {/* Demo Credentials - Only show in development */}
            {process.env.NODE_ENV !== 'production' && (
              <div className="mt-6 md:mt-8 pt-5 md:pt-6 border-t border-gray-100">
                <p className="text-xs md:text-sm font-medium text-gray-500 text-center mb-3 md:mb-4">
                  {t('demo.title')}
                </p>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => { setEmail('admin@herbal-erp.com'); setPassword('admin123'); }}
                    className="px-3 md:px-4 py-2.5 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 rounded-lg text-sm text-gray-600 hover:text-emerald-700 transition-all duration-200 flex items-center justify-between"
                  >
                    <span className="font-medium">Admin</span>
                    <span className="text-gray-400 text-xs md:text-sm truncate ml-2">admin@herbal-erp.com</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEmail('production@herbal-erp.com'); setPassword('user123'); }}
                    className="px-3 md:px-4 py-2.5 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 rounded-lg text-sm text-gray-600 hover:text-emerald-700 transition-all duration-200 flex items-center justify-between"
                  >
                    <span className="font-medium">Production</span>
                    <span className="text-gray-400 text-xs md:text-sm truncate ml-2">production@herbal-erp.com</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEmail('qc@herbal-erp.com'); setPassword('user123'); }}
                    className="px-3 md:px-4 py-2.5 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 rounded-lg text-sm text-gray-600 hover:text-emerald-700 transition-all duration-200 flex items-center justify-between"
                  >
                    <span className="font-medium">QC</span>
                    <span className="text-gray-400 text-xs md:text-sm truncate ml-2">qc@herbal-erp.com</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEmail('hr@herbal-erp.com'); setPassword('user123'); }}
                    className="px-3 md:px-4 py-2.5 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 rounded-lg text-sm text-gray-600 hover:text-emerald-700 transition-all duration-200 flex items-center justify-between"
                  >
                    <span className="font-medium">HR</span>
                    <span className="text-gray-400 text-xs md:text-sm truncate ml-2">hr@herbal-erp.com</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <p className="text-center text-xs md:text-sm text-gray-400 mt-6 md:mt-8">
            {t('footer.copyright')}
          </p>
          {/* App version + build date — frozen at build time (see next.config.ts) */}
          <p className="text-center text-xs font-medium text-gray-500 mt-2">
            v{process.env.NEXT_PUBLIC_APP_VERSION}
            {process.env.NEXT_PUBLIC_BUILD_DATE ? ` · ${process.env.NEXT_PUBLIC_BUILD_DATE}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
