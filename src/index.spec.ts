import { buildError } from './index'

describe('Errory buildError() func', () => {    
        
    it('should create a plain Errory constructor', () => {
        const error = buildError({})
        expect(error).toBeDefined()
    })

    it('should have a method "is()" which checks if an Error is an Errory error', () => {
        const error = buildError({})
        const someError = error('some error message')
        expect(error.is(someError)).toBe(true)
    })

    it('should have method "is()" which check if an Error is an Errory error and a specific type', () => {
        const error = buildError({
            AuthError: { context: { credentialsMismatch: 'boolean'}},
            DBError: { context: { table: 'string', column: 'string' }},
            SocketError: { context: { brokenPipe: 'boolean' }}
        })
        const err = error('some error').type('DBError')
        expect(error.is(err, 'DBError')).toEqual(true)
        expect(error.is(err, 'AuthError')).toEqual(false)
    })

    it('should construct an error with a wrapped error when given an Error object as the last argument', () => {
        const error = buildError({
            AuthError: { context: { credentialsMismatch: 'boolean'}},
            DBError: { context: { table: 'string', column: 'string' }},
            SocketError: { context: { brokenPipe: 'boolean' }}
        })
        const wrappedError = new Error('wrapped error')
        const err = error('some error', wrappedError)
        expect(err.wrappedError()).toEqual(wrappedError)
    })

})

describe('Errory error constructor',  () => {

    it('should have method "type" which should set the type of an untyped Errory error', () =>{
        const error = buildError({ 
            typeA: { context: {}},
            typeB: { context: {}},
            typeC: { context: {}},
        })

        const err = error('some error').type('typeA')
        expect(err.type()).toBe('typeA')
    })

    it('should have method "type" which should throw if setting the type of a typed Errory error', () =>{
        const error = buildError({ 
            typeA: { context: {}},
            typeB: { context: {}},
            typeC: { context: {}},
        })

        const err = error('some error').type('typeA')
        expect(() => err.type('typeB')).toThrow()
    })
    it('should have "is[ErrorType]()" method for each error type specified', () => {
        const error = buildError({ 
            typeA: { context: {}},
            typeB: { context: {}},
            typeC: { context: {}},
        })

        const err = error('some error')

        expect(err.isTypeA).toBeInstanceOf(Function)
        expect(err.isTypeB).toBeInstanceOf(Function)
        expect(err.isTypeC).toBeInstanceOf(Function)
    })

    it('should successfully construct an Errory error with a type', () => {
        const error = buildError({ someType: { context: { some: 'string' } } })
        type error = ReturnType<typeof error>
        const err: error = error('something went wrong').type('someType', { some: 'value'})
        expect(err.type()).toEqual('someType')
    })
})