import type { Metadata } from "next";
import { productSubscriptionUrl } from "../../entitlement/deeplink";

export const metadata: Metadata = { title: "Arda · 套餐与权益" };

// Keep old bookmarks useful without publishing the internal C2 rule matrix.
export default function EntitlementInfoPage() {
  return (
    <main className="content-inner">
      <h1>Arda 套餐与权益</h1>
      <p>查看当前在售套餐、价格和配额，请前往 Arda 套餐页。</p>
      <p><a href={productSubscriptionUrl()}>查看套餐与价格</a></p>
      <p>查看工作空间当前的订阅权益，请先登录 Arda。</p>
      <p><a href="/">登录 Arda</a></p>
    </main>
  );
}
