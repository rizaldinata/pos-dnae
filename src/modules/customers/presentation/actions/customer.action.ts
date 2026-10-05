"use server";

import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";

export interface CustomerDTO {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  points: number;
  receivableBalance: number;
}

export interface CustomerActionState {
  success: boolean;
  message: string | null;
}

const INITIAL: CustomerActionState = { success: false, message: null };

function toDTO(customer: {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  points: number;
  receivableBalance: number;
}): CustomerDTO {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    points: customer.points,
    receivableBalance: customer.receivableBalance,
  };
}

async function guardCustomer(): Promise<null | CustomerActionState> {
  const result = await requirePermission("customer.manage");
  if (!result.ok) {
    return { ...INITIAL, message: result.message };
  }
  return null;
}

export async function createCustomerAction(
  _prevState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const denied = await guardCustomer();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.customers.createCustomer.execute({
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/pelanggan");
  return {
    success: true,
    message: `Pelanggan "${result.data.name}" berhasil ditambahkan`,
  };
}

export async function updateCustomerAction(
  _prevState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const denied = await guardCustomer();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.customers.updateCustomer.execute(
    String(formData.get("customerId") ?? ""),
    {
      name: String(formData.get("name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      address: String(formData.get("address") ?? "").trim(),
    }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/pelanggan");
  return {
    success: true,
    message: `Pelanggan "${result.data.name}" berhasil diperbarui`,
  };
}

export async function deleteCustomerAction(
  customerId: string
): Promise<CustomerActionState> {
  const denied = await guardCustomer();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.customers.deleteCustomer.execute(customerId);
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/pelanggan");
  return { success: true, message: "Pelanggan berhasil dihapus" };
}

export async function searchCustomersAction(
  query: string,
  limit = 10
): Promise<CustomerDTO[]> {
  const container = await getAppContainer();
  const current = await container.iam.getCurrentUser.execute();
  if (isErr(current) || current.data === null) {
    return [];
  }
  const result = await container.customers.searchCustomers.execute(
    query,
    limit
  );
  if (isErr(result)) {
    return [];
  }
  return result.data.map(toDTO);
}
