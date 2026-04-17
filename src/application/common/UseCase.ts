export interface UseCase<TInput, TOutput> {
  run(input: TInput): Promise<TOutput>
}
