import React, { useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";

export const PWAInstallButton: React.FC<{ variant?: "default" | "outline" | "secondary"; className?: string }> = ({
  variant = "outline",
  className = "",
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Se já estiver rodando em modo standalone / PWA instalado, não mostra
  if (isInstalled) {
    return null;
  }

  // Fluxo Chromium / Android / Desktop
  if (isInstallable) {
    return (
      <Button
        variant={variant}
        size="sm"
        onClick={install}
        className={`flex items-center gap-1.5 text-xs font-medium shadow-xs ${className}`}
      >
        <Download className="w-3.5 h-3.5 text-primary" />
        <span>Instalar App</span>
      </Button>
    );
  }

  // Fluxo iOS Safari
  if (isIOS) {
    return (
      <>
        <Button
          variant={variant}
          size="sm"
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 text-xs font-medium ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5 text-primary" />
          <span>Instalar no iPhone</span>
        </Button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-xl bg-card border p-5 shadow-2xl text-left space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  Instalar Belezi no iPhone / iPad
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="text-xs text-muted-foreground space-y-2">
                <p>Para ter acesso direto como um aplicativo nativo:</p>
                <ol className="list-decimal pl-4 space-y-1 text-foreground">
                  <li>
                    Toque no botão de <strong>Compartilhar</strong> (ícone do quadrado com seta para cima no Safari).
                  </li>
                  <li>
                    Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.
                  </li>
                  <li>Toque em <strong>Adicionar</strong> no canto superior direito.</li>
                </ol>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowIOSGuide(false)}
                className="w-full text-xs mt-2"
              >
                Entendi
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback discreto com instruções de app móvel
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={() => setShowIOSGuide(true)}
      className={`flex items-center gap-1.5 text-xs font-medium ${className}`}
      title="Instalar como aplicativo no celular"
    >
      <Download className="w-3.5 h-3.5 text-primary" />
      <span>Instalar App</span>
      {showIOSGuide && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-sm rounded-xl bg-card border p-5 shadow-2xl text-left space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                Como instalar o Aplicativo
              </h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="text-xs text-muted-foreground space-y-2">
              <p>Você pode instalar o Belezi direto no seu celular:</p>
              <ul className="list-disc pl-4 space-y-1 text-foreground">
                <li>No <strong>Android / Chrome</strong>: Toque nos três pontinhos do menu e em "Instalar aplicativo".</li>
                <li>No <strong>iPhone / Safari</strong>: Toque em Compartilhar e depois em "Adicionar à Tela de Início".</li>
              </ul>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowIOSGuide(false)}
              className="w-full text-xs mt-2"
            >
              Fechar
            </Button>
          </div>
        </div>
      )}
    </Button>
  );
};
