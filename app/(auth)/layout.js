export default function AuthLayout({ children }) {
  return (
    <div className="bg-white min-h-[calc(100vh-60px)] flex items-start justify-center px-6 pt-16 pb-24">
      {children}
    </div>
  );
}
