import { Outlet } from "@tanstack/react-router";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

export default function AdminLayout() {
    return (

        <div className="flex">

            <Sidebar />

            <div className="flex-1">

                <Header />

                <div className="p-8">

                    <Outlet />

                </div>

            </div>

        </div>

    );
}