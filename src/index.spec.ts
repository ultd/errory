import { buildError } from './index'

describe('Errory buildError() function', () => {    
        
    it('should create a plain Errory constructor', () => {
        const error = buildError({})
        expect(error).toBeDefined()
    })

    it('should have a method "is()" which checks if an Error is an Errory error', () => {
        const error = buildError({})
        expect(error.is(error('some error message'))).toBe(true)
    })

    it('should have method "is()" which check if an Error is an Errory error and a specific type', () => {
        const error = buildError({
            AuthError: { context: { credentialsMismatch: 'boolean'}},
            DBError: { context: { table: 'string', column: 'string' }},
            SocketError: { context: { brokenPipe: 'boolean' }}
        })

        expect(error.is(error('some error').type('DBError'), 'DBError')).toEqual(true)
        expect(error.is(error('some error').type('DBError'), 'AuthError')).toEqual(false)
    })

})