import React from 'react';
import { Container, Card, Form, Button } from 'react-bootstrap';
import { Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock login, just navigate to dashboard
    navigate('/dashboard');
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-dark" style={{ backgroundColor: '#0a0a0c' }}>
      <Container className="d-flex justify-content-center">
        <Card bg="dark" border="secondary" className="shadow-lg" style={{ width: '100%', maxWidth: '400px' }}>
          <Card.Body className="p-5 text-center">
            <div className="mb-4">
              <Shield className="text-primary mb-3" size={64} />
              <h3 className="text-light fw-bold tracking-tight">6G Trust Defender</h3>
              <p className="text-secondary small">Operator Access Portal</p>
            </div>
            
            <Form onSubmit={handleLogin}>
              <Form.Group className="mb-3 text-start">
                <Form.Label className="text-secondary small">Operator ID</Form.Label>
                <Form.Control type="text" placeholder="Enter ID" required className="bg-dark text-light border-secondary" />
              </Form.Group>
              
              <Form.Group className="mb-4 text-start">
                <Form.Label className="text-secondary small">Access Token</Form.Label>
                <Form.Control type="password" placeholder="Enter Token" required className="bg-dark text-light border-secondary" />
              </Form.Group>
              
              <Button variant="primary" type="submit" className="w-100 fw-bold py-2">
                Authenticate & Connect
              </Button>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
};

export default LoginPage;
