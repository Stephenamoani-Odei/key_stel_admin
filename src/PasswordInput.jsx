import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
export default function PasswordInput(props) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw">
      <input {...props} type={show ? 'text' : 'password'} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
    </div>
  )
}
