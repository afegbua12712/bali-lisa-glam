import { Link } from "@tanstack/react-router";
import {
    LayoutDashboard,
    ShoppingBag,
    Users,
    Settings,
    CreditCard,
    Package
} from "lucide-react";

const menu = [
    {
        name: "Dashboard",
        url: "/admin",
        icon: LayoutDashboard,
    },
    {
        name: "Products",
        url: "/admin/products",
        icon: ShoppingBag,
    },
    {
        name: "Orders",
        url: "/admin/orders",
        icon: Package,
    },
    {
        name: "Customers",
        url: "/admin/customers",
        icon: Users,
    },
    {
        name: "Payments",
        url: "/admin/payments",
        icon: CreditCard,
    },
    {
        name: "Settings",
        url: "/admin/settings",
        icon: Settings,
    },
];

export default function Sidebar() {
    return (
        <aside className="w-64 border-r bg-white min-h-screen">

            <div className="p-6 border-b">

                <h1 className="text-2xl font-bold">
                    GlowLux Admin
                </h1>

            </div>

            <nav className="p-4 space-y-2">

                {menu.map((item) => {

                    const Icon = item.icon;

                    return (

                        <Link
                            key={item.name}
                            to={item.url}
                            className="flex items-center gap-3 rounded-lg p-3 hover:bg-gray-100"
                        >
                            <Icon size={18} />

                            {item.name}

                        </Link>

                    );

                })}

            </nav>

        </aside>
    );
}