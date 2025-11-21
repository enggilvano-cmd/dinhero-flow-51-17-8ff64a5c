import { Layout } from "@/components/Layout";

const BybitPage = () => {
  return (
    <Layout currentPage="bybit" onNavigate={() => {}} loading={false}>
      <h1 className="text-2xl font-bold">Bybit Integration</h1>
    </Layout>
  );
};

export default BybitPage;