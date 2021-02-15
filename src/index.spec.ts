import { buildError } from './index'

describe('Errory buildError() function', () => {    
        
    it('should create an plain Errory error constructor', () => {
        const error = buildError({})
        expect(error).toBeDefined()
    })

    it('should have a method "is()" which checks if an Error is an Errory error', () => {
        const error = buildError({})
        expect(error.is(error('some error message'))).toBe(true)
    })

    it('should construct error with methods')

})