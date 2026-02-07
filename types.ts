
export interface Product {
  id: number;
  nome: string;
  cm: string;
  valor: number;
  imagem?: string;
}

export interface BudgetItem extends Product {
  quantity: number;
  total: number;
}

export interface ClientInfo {
  name: string;
  phone: string;
  date: string;
}
