// Double circulation: the route one red blood cell takes, in order. Each part has the blood's oxygen level.

export const ROUTE = [
  { id: 'vena', name: 'Vena cava', oxygen: 'low', info: 'Large veins bringing used (deoxygenated) blood back from the body.' },
  { id: 'ra', name: 'Right atrium', oxygen: 'low', info: 'Receives blood from the body and squeezes it into the right ventricle.' },
  { id: 'tricuspid', name: 'Tricuspid valve', oxygen: 'low', info: 'One-way valve between the right atrium and right ventricle.' },
  { id: 'rv', name: 'Right ventricle', oxygen: 'low', info: 'Pumps blood to the lungs. Thinner wall than the left: the lungs are close.' },
  { id: 'partery', name: 'Pulmonary artery', oxygen: 'low', info: 'The only artery that carries deoxygenated blood, to the lungs.' },
  { id: 'lungs', name: 'Lungs', oxygen: 'gain', info: 'Blood drops off CO₂ and picks up O₂ in tiny capillaries around the alveoli.' },
  { id: 'pvein', name: 'Pulmonary veins', oxygen: 'high', info: 'The only veins that carry oxygenated blood, back to the heart.' },
  { id: 'la', name: 'Left atrium', oxygen: 'high', info: 'Receives oxygen-rich blood from the lungs.' },
  { id: 'mitral', name: 'Mitral (bicuspid) valve', oxygen: 'high', info: 'One-way valve between the left atrium and left ventricle.' },
  { id: 'lv', name: 'Left ventricle', oxygen: 'high', info: 'The strongest chamber, with the thickest wall: it pumps blood to the whole body.' },
  { id: 'aorta', name: 'Aorta', oxygen: 'high', info: 'The largest artery. Carries oxygen-rich blood to the body under high pressure.' },
  { id: 'body', name: 'Body tissues', oxygen: 'lose', info: 'In capillaries, cells take the O₂ and give back CO₂. The blood is now deoxygenated.' },
];

/** Two circuits: pulmonary (heart → lungs → heart) and systemic (heart → body → heart). */
export const circuitOf = (id) => (['rv', 'partery', 'lungs', 'pvein', 'la'].includes(id) ? 'pulmonary' : 'systemic');

/** Blood passes through the heart twice per full loop (double circulation). */
export const heartVisits = () => ROUTE.filter((s) => ['ra', 'la'].includes(s.id)).length;
