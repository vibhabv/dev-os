import { z } from 'zod'

export const uploadContractSchema = z.object({
  contractType: z.enum(['nda', 'msa'], { message: 'Contract type must be NDA or MSA.' }),
})
