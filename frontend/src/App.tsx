import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Landing } from "@/pages/Landing";
import { Home } from "@/pages/Home";
import { CreateSale } from "@/pages/CreateSale";
import { SaleDetail } from "@/pages/SaleDetail";
import { MyActivity } from "@/pages/MyActivity";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="create" element={<CreateSale />} />
          <Route path="sale/:id" element={<SaleDetail />} />
          <Route path="my" element={<MyActivity />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
