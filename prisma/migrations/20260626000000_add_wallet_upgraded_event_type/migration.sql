-- Añade el tipo de evento `wallet_upgraded`, emitido cuando un pase evoluciona
-- al siguiente nivel (tier) de su wallet. Aislado en su propia migración:
-- `ALTER TYPE ... ADD VALUE` no debe compartir transacción con sentencias que
-- usen el nuevo valor.
ALTER TYPE "PassEventType" ADD VALUE 'wallet_upgraded';
