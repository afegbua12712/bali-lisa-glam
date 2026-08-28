export function Dashboard() {

    return (

        <>

            <h1 className="text-3xl font-bold">

                Dashboard

            </h1>

            <div className="grid grid-cols-4 gap-6 mt-10">

                <div className="rounded-xl bg-white shadow p-6">

                    Products

                    <h2 className="text-4xl font-bold mt-3">

                        0

                    </h2>

                </div>

                <div className="rounded-xl bg-white shadow p-6">

                    Orders

                    <h2 className="text-4xl font-bold mt-3">

                        0

                    </h2>

                </div>

                <div className="rounded-xl bg-white shadow p-6">

                    Customers

                    <h2 className="text-4xl font-bold mt-3">

                        0

                    </h2>

                </div>

                <div className="rounded-xl bg-white shadow p-6">

                    Revenue

                    <h2 className="text-4xl font-bold mt-3">

                        ₦0

                    </h2>

                </div>

            </div>

        </>

    );

}