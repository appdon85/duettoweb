"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Painel lateral (slide-over) usado pelo padrao "grid primeiro, formulario so
 * quando o usuario pede" nas telas de cadastro (Empresas, Contatos, Negocios,
 * Atividades) - ver decisao do usuario de usar drawer em vez de modal/pagina
 * dedicada. Desliza a partir da direita sobre um fundo (overlay) que escurece
 * o resto da tela; fecha via botao X, clique no overlay ou tecla ESC.
 *
 * Nao desmonta o conteudo quando fechado (so' esconde via CSS) para preservar
 * o estado do formulario entre aberturas rapidas - quem usa este componente
 * controla `open` a partir do proprio estado (ex.: isFormOpen).
 */
export function Drawer({ open, onClose, title, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Visibilidade real via CSS `visibility` (nao so opacidade/transform) - um
  // elemento deslocado com transform ainda tem uma bounding box "visivel" do
  // ponto de vista de acessibilidade/automação (leitores de tela, testes),
  // entao o fechamento so marca `invisible` DEPOIS que a transicao de saida
  // termina (delay = duracao da transicao), enquanto a abertura marca
  // `visible` imediatamente (delay 0) para a animacao de entrada tocar.
  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-40 ${
        open
          ? "visible transition-[visibility] duration-0"
          : "invisible transition-[visibility] delay-200 duration-0"
      }`}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-zinc-900/30 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute top-0 right-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
