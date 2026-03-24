import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { loginUser, registerUser, loginGuest } from '../../api';
import { useAuth } from '../context/AuthContext';
import { PhyPrepLogo } from './PhyPrepLogo';

const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [examBoard, setExamBoard] = useState('');
  const [targetExam, setTargetExam] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (isLogin) {
        const res = await loginUser(email, password);
        login(res.access_token, res.student_id);
      } else {
        const res = await registerUser(email, password, name, level, examBoard, targetExam);
        login(res.access_token, res.student_id);
      }
      navigate('/chat');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await loginGuest();
      login(res.access_token, res.student_id);
      navigate('/chat');
    } catch (err: any) {
      setError(err.message || 'Guest login failed.');
    } finally {
      setLoading(false);
    }
  };


  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail) {
      setNewsletterSubscribed(true);
      setNewsletterEmail('');
      setTimeout(() => setNewsletterSubscribed(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col md:flex-row text-white font-sans selection:bg-indigo-500/30">
      {/* Left Panel: Hero & Newsletter */}
      <div className="md:w-1/2 p-8 md:p-16 flex flex-col justify-between bg-gradient-to-br from-gray-900 to-black relative overflow-hidden">
        
        {/* Decorative Grid */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        
        {/* Floating Shapes */}
        <div className="absolute top-1/4 -left-12 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-1/3 -right-12 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/3 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

        <div className="relative z-10 flex flex-col gap-8 h-full">
          <div>
            <PhyPrepLogo />
            <h1 className="mt-12 text-5xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-500">
              Your AI Math <br />
              <span className="text-indigo-400">Thinking Engine.</span>
            </h1>
            <p className="mt-6 text-xl text-gray-400 max-w-lg leading-relaxed font-light">
              Master JEE Mathematics, Physics, and Chemistry. Switch between <span className="text-indigo-300 font-medium">Brain Mode</span> for step-by-step guidance and <span className="text-red-400 font-medium">SOS Mode</span> for instant solutions.
            </p>
          </div>

          <div className="mt-auto pt-16">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Join our newsletter</h3>
            <form onSubmit={handleNewsletter} className="flex gap-3 mt-2">
              <input 
                type="email" 
                placeholder="Enter your email" 
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                className="bg-gray-800/50 border border-gray-700 text-sm rounded-lg block w-full p-2.5 focus:ring-indigo-500 focus:border-indigo-500 text-white placeholder-gray-400 backdrop-blur-sm transition-all"
              />
              <button 
                type="submit"
                className="text-white bg-indigo-600 hover:bg-indigo-700 font-medium rounded-lg text-sm px-5 py-2.5 focus:outline-none focus:ring-4 focus:ring-indigo-800 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                Subscribe
              </button>
            </form>
            {newsletterSubscribed && (
              <p className="text-green-400 text-sm mt-3 animate-fade-in-up">Thanks for subscribing!</p>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel: Auth Forms */}
      <div className="md:w-1/2 flex items-center justify-center p-8 bg-black/60 backdrop-blur-3xl md:border-l border-gray-800/50 shadow-2xl relative z-20">
        <div className="w-full max-w-md bg-gray-900/40 p-8 rounded-2xl border border-gray-800 shadow-2xl backdrop-blur-md">
          <h2 className="text-3xl font-bold mb-2">{isLogin ? 'Welcome back' : 'Create an account'}</h2>
          <p className="text-gray-400 mb-8">
            {isLogin ? 'Enter your details to access your account.' : 'Start your mastery journey today.'}
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-800/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {!isLogin && (
              <div className="group">
                <label className="block mb-1.5 text-sm font-medium text-gray-300">Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
                    <User size={18} />
                  </div>
                  <input 
                    type="text" 
                    required={!isLogin}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-gray-950 border border-gray-700 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 p-2.5 transition-colors group-hover:border-gray-600" 
                    placeholder="Daksh" 
                  />
                </div>
              </div>
            )}

            <div className="group">
              <label className="block mb-1.5 text-sm font-medium text-gray-300">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-gray-950 border border-gray-700 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 p-2.5 transition-colors group-hover:border-gray-600" 
                  placeholder="name@example.com" 
                />
              </div>
            </div>

            <div className="group">
              <label className="block mb-1.5 text-sm font-medium text-gray-300">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-gray-950 border border-gray-700 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 p-2.5 transition-colors group-hover:border-gray-600" 
                  placeholder="••••••••" 
                />
              </div>
            </div>

            {!isLogin && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block mb-1.5 text-xs font-medium text-gray-400">Level</label>
                  <select 
                    value={level} 
                    onChange={(e) => setLevel(e.target.value)}
                    className="bg-gray-950 border border-gray-700 text-gray-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"
                  >
                    <option value="">Select Level</option>
                    <option value="Class 11">Class 11</option>
                    <option value="Class 12">Class 12</option>
                    <option value="Dropper">Dropper</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1.5 text-xs font-medium text-gray-400">Board</label>
                  <select 
                    value={examBoard} 
                    onChange={(e) => setExamBoard(e.target.value)}
                    className="bg-gray-950 border border-gray-700 text-gray-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"
                  >
                    <option value="">Select Board</option>
                    <option value="CBSE">CBSE</option>
                    <option value="ISC">ISC</option>
                    <option value="State Board">State Board</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block mb-1.5 text-xs font-medium text-gray-400">Target Exam</label>
                  <select 
                    value={targetExam} 
                    onChange={(e) => setTargetExam(e.target.value)}
                    className="bg-gray-950 border border-gray-700 text-gray-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"
                  >
                    <option value="">Select Target Exam</option>
                    <option value="JEE Main">JEE Main</option>
                    <option value="JEE Advanced">JEE Advanced</option>
                    <option value="NEET">NEET</option>
                  </select>
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full text-white bg-indigo-600 hover:bg-indigo-500 focus:ring-4 focus:outline-none focus:ring-indigo-500/50 font-medium rounded-lg text-sm px-5 py-3 text-center flex items-center justify-center gap-2 mt-6 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : (isLogin ? 'Sign in' : 'Create account')}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="text-sm font-light text-gray-400 mt-8 text-center">
            {isLogin ? "Don't have an account yet?" : "Already have an account?"}{' '}
            <button 
              type="button"
              onClick={() => setIsLogin(!isLogin)} 
              className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          <div className="mt-6 flex items-center justify-center space-x-4">
            <div className="flex-1 border-t border-gray-800"></div>
            <span className="text-gray-500 text-sm">OR</span>
            <div className="flex-1 border-t border-gray-800"></div>
          </div>

          <button 
            type="button" 
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full text-indigo-400 bg-transparent border border-indigo-600/30 hover:bg-indigo-900/20 focus:ring-4 focus:outline-none focus:ring-indigo-900/30 font-medium rounded-lg text-sm px-5 py-3 text-center flex items-center justify-center gap-2 mt-6 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
          >
            <Sparkles size={16} />
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
