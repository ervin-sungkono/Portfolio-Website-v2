import { CmsDraftProvider } from '@/components/admin/CmsDraftProvider';

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <CmsDraftProvider>{children}</CmsDraftProvider>;
}
