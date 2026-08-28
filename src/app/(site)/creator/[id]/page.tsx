import { redirect } from 'next/navigation';

/** /creator/[id] → /user/[id]（V3-5 永久跳转，兼容旧链接） */
export default function CreatorRedirect({ params }: { params: { id: string } }) {
  redirect(`/user/${params.id}`);
}
