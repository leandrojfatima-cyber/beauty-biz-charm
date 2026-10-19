import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class LocalRouteErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("[LocalRouteErrorBoundary] Intercepted runtime error:", error, errorInfo);
  }

  public reset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
          <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-semibold text-foreground text-lg">
              {this.props.fallbackTitle ?? "Instabilidade temporária nesta guia"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.error?.message ||
                "Ocorreu um erro ao carregar os dados desta seção. O restante do sistema permanece totalmente operacional."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={this.reset}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Tentar novamente
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/painel">Voltar ao Painel</Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
